import { Prisma, PlanJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planUret, PlanUretilemediHatasi } from "@/lib/plan-generation";
import type { PlanRequestInput } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";

/**
 * AI plan üretim işlerinin yaşam döngüsü (Aşama 3).
 *
 * NEDEN VAR: üretim en kötü durumda 8 ardışık LLM çağrısı ve 240 saniye.
 * Bunu tek bir HTTP isteğinde tutmak bir zaman aşımı ayarı meselesi değil,
 * mimari bir sınırdı: kullanıcı sekmeyi kapatınca iş yarıda kalıyor,
 * yeniden denemenin yolu yok ve o süre boyunca bir bağlantı meşgul.
 *
 * Yeni akış:
 *   POST /api/trip-plan-model  → iş kaydı açar, 202 + jobId döner
 *   (arka plan)                → `calistir` üretimi yapar, kaydı günceller
 *   GET  /api/plan-jobs/[id]   → istemci durumu sorgular
 *
 * ÇALIŞTIRMA MODELİ: `next/server`'ın `after()` fonksiyonu yanıt
 * gönderildikten sonra çalışıyor. Gerçek bir kuyruk (SQS, BullMQ) değil;
 * ayrı bir işçi süreci gerektirmediği için mevcut dağıtıma uyuyor. Sınırı
 * şu: sunucu üretim ortasında yeniden başlarsa iş RUNNING'de asılı kalır.
 * `asilKalanlariTemizle` bunu topluyor.
 */

/** Bu süreden uzun süre RUNNING kalan iş ölmüş sayılır. */
const ASILMA_SINIRI_MS = 10 * 60 * 1000;

/** Aynı anda birden çok üretim başlatmayı engelleyen pencere. */
const DEVAM_EDEN_SAYILIR_MS = 6 * 60 * 1000;

export interface IsOzeti {
  id: string;
  status: PlanJobStatus;
  step: string | null;
  tripPlanId: string | null;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

/**
 * Kullanıcının devam eden bir işi var mı?
 *
 * Aynı anda iki üretim başlatmak hem kotayı hem sağlayıcı maliyetini boşa
 * harcıyor; kullanıcı da genelde "bir şey olmadı" sanıp tekrar tıklıyor.
 */
export async function devamEdenIs(userId: string): Promise<IsOzeti | null> {
  const esik = new Date(Date.now() - DEVAM_EDEN_SAYILIR_MS);

  const is = await prisma.planJob.findFirst({
    where: {
      userId,
      status: { in: [PlanJobStatus.QUEUED, PlanJobStatus.RUNNING] },
      createdAt: { gte: esik },
    },
    orderBy: { createdAt: "desc" },
    select: ozetAlanlari,
  });

  return is;
}

const ozetAlanlari = {
  id: true,
  status: true,
  step: true,
  tripPlanId: true,
  error: true,
  createdAt: true,
  finishedAt: true,
} as const;

/** Yeni bir iş kaydı açar. */
export async function isOlustur(
  userId: string,
  girdi: PlanRequestInput
): Promise<IsOzeti> {
  return prisma.planJob.create({
    data: {
      userId,
      status: PlanJobStatus.QUEUED,
      // Girdiyi saklıyoruz: yeniden deneme için tek kaynak bu.
      request: girdi as unknown as Prisma.InputJsonValue,
    },
    select: ozetAlanlari,
  });
}

/** İşin durumunu okur; sahiplik kontrolü dahil. */
export async function isOku(jobId: string, userId: string): Promise<IsOzeti | null> {
  return prisma.planJob.findFirst({
    where: { id: jobId, userId },
    select: ozetAlanlari,
  });
}

/**
 * İşi çalıştırır.
 *
 * Bu fonksiyon HİÇBİR ZAMAN fırlatmaz: `after()` içinde çalışıyor ve orada
 * yakalanmayan bir hata sessizce kaybolur, iş de sonsuza kadar RUNNING
 * kalırdı. Her çıkış yolu kaydı sonlandırıyor.
 */
export async function calistir(jobId: string): Promise<void> {
  const is = await prisma.planJob.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true, request: true, status: true },
  });

  if (!is) {
    logger.error("Çalıştırılacak iş bulunamadı", undefined, { jobId });
    return;
  }

  if (is.status !== PlanJobStatus.QUEUED) {
    // Çift tetikleme; ikinci çağrı sessizce çıkıyor.
    logger.warn("İş zaten başlamış, atlanıyor", undefined, {
      jobId,
      status: is.status,
    });
    return;
  }

  await prisma.planJob.update({
    where: { id: jobId },
    data: {
      status: PlanJobStatus.RUNNING,
      startedAt: new Date(),
      step: "basladi",
    },
  });

  try {
    const sonuc = await planUret(
      is.request as unknown as PlanRequestInput,
      { userId: is.userId },
      async (adim) => {
        await prisma.planJob.update({
          where: { id: jobId },
          data: { step: adim },
        });
      }
    );

    await prisma.planJob.update({
      where: { id: jobId },
      data: {
        status: PlanJobStatus.SUCCEEDED,
        tripPlanId: sonuc.tripPlanId,
        step: "tamamlandi",
        finishedAt: new Date(),
        error: null,
      },
    });

    logger.info("Plan üretim işi tamamlandı", {
      jobId,
      tripPlanId: sonuc.tripPlanId,
      format: sonuc.format,
    });
  } catch (error) {
    logger.error("Plan üretim işi başarısız", error, { jobId });

    // Kullanıcıya gösterilecek mesaj; teknik ayrıntı yalnızca log'da.
    const mesaj =
      error instanceof PlanUretilemediHatasi
        ? error.message
        : "Plan oluşturulurken beklenmeyen bir hata oluştu";

    await prisma.planJob
      .update({
        where: { id: jobId },
        data: {
          status: PlanJobStatus.FAILED,
          error: mesaj,
          step: "hata",
          finishedAt: new Date(),
        },
      })
      .catch((guncellemeHatasi) => {
        // Veritabanı da erişilemezse yapacak bir şey yok; en azından iz kalsın.
        logger.error("İş hatası kaydedilemedi", guncellemeHatasi, { jobId });
      });
  }
}

/**
 * Asılı kalmış işleri FAILED'a çeker.
 *
 * Sunucu üretim ortasında yeniden başlarsa iş RUNNING'de kalır ve kullanıcı
 * sonsuza kadar "hazırlanıyor" görür. Durum sorgulama ucu her çağrıldığında
 * bu temizlik ucuza çalışıyor; ayrı bir zamanlanmış göreve gerek kalmıyor.
 */
export async function asilKalanlariTemizle(userId: string): Promise<number> {
  const esik = new Date(Date.now() - ASILMA_SINIRI_MS);

  const { count } = await prisma.planJob.updateMany({
    where: {
      userId,
      status: { in: [PlanJobStatus.QUEUED, PlanJobStatus.RUNNING] },
      createdAt: { lt: esik },
    },
    data: {
      status: PlanJobStatus.FAILED,
      error: "Plan üretimi zaman aşımına uğradı, lütfen tekrar deneyin",
      step: "zaman-asimi",
      finishedAt: new Date(),
    },
  });

  if (count > 0) {
    logger.warn("Asılı kalmış plan işleri temizlendi", undefined, { count });
  }

  return count;
}
