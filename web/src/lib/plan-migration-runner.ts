import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planiTaslagaCevir, type TasimaEngeli } from "@/lib/plan-migration";
import { logger } from "@/lib/logger";

/**
 * `TripPlan` satırlarını ilişkisel modele taşıyan çalıştırıcı.
 *
 * Dönüşümün kendisi saf bir fonksiyonda (plan-migration.ts); burası yalnızca
 * veritabanı tarafı. İkisi ayrı çünkü dönüşüm testlenebilir olmalı,
 * yazma ise tek bir işlemde (transaction) atomik olmalı.
 *
 * TASARIM KURALLARI
 *
 *  - **Yıkıcı değil.** JSON sütunlarına dokunulmuyor. Taşınan plan
 *    `migratedAt` damgası ve `tripId` bağıyla işaretleniyor; JSON hâlâ
 *    orada duruyor. Bir sorun çıkarsa arayüz eski yola dönebilir.
 *  - **Yeniden çalıştırılabilir.** `migratedAt` dolu satırlar atlanıyor.
 *    Zorlamak gerekirse `yenidenTasi` ile önceki alt kayıtlar silinip
 *    yeniden yazılıyor — kısmi kalmış bir taşımayı düzeltmenin yolu bu.
 *  - **Atomik.** Trip + bütçe + günlük planlar ve `migratedAt` damgası tek
 *    transaction'da yazılıyor. Yarım taşınmış bir plan, iki modelin de
 *    yanlış olduğu bir durum demek olurdu.
 */

export interface TasimaSonucu {
  planId: string;
  durum: "tasindi" | "atlandi" | "zaten-tasinmis" | "hata";
  tripId?: string;
  engel?: TasimaEngeli;
  uyarilar?: string[];
  hata?: string;
  sayilar?: { budgetItems: number; dailyPlans: number };
}

export interface TasimaOzeti {
  toplam: number;
  tasindi: number;
  atlandi: number;
  zatenTasinmis: number;
  hata: number;
  sonuclar: TasimaSonucu[];
}

/** Dönüştürücünün okuduğu alanlar; tek yerde tanımlı olsun diye sabit. */
const TASIMA_ALANLARI = {
  id: true,
  city: true,
  country: true,
  startDate: true,
  endDate: true,
  status: true,
  total_cost: true,
  sehir_bilgisi: true,
  pratik_bilgiler: true,
  gun_plani: true,
  butce_tahmini: true,
  tripId: true,
  userId: true,
  migratedAt: true,
} as const;

/**
 * Tek bir planı taşır.
 *
 * @param yenidenTasi  Zaten taşınmış bir planı yeniden taşır: bağlı Trip'in
 *                     bütçe kalemleri ve günlük planları silinip JSON'dan
 *                     yeniden üretilir. Sahibi değişmez.
 */
export async function planiTasi(
  planId: string,
  secenekler: { yenidenTasi?: boolean } = {}
): Promise<TasimaSonucu> {
  const plan = await prisma.tripPlan.findUnique({
    where: { id: planId },
    select: TASIMA_ALANLARI,
  });

  if (!plan) {
    return { planId, durum: "hata", hata: "Plan bulunamadı" };
  }

  if (!plan.userId) {
    // Sahipsiz plan taşınamaz: Trip.userId zorunlu.
    return { planId, durum: "atlandi", engel: "sehir-yok", hata: "Planın sahibi yok" };
  }

  if (plan.migratedAt && !secenekler.yenidenTasi) {
    return { planId, durum: "zaten-tasinmis", tripId: plan.tripId ?? undefined };
  }

  const donusum = planiTaslagaCevir(plan);
  if (!donusum.ok) {
    return { planId, durum: "atlandi", engel: donusum.engel };
  }

  const { taslak, uyarilar } = donusum;
  const userId = plan.userId;

  try {
    const tripId = await prisma.$transaction(async (tx) => {
      // 1. Trip: varsa güncelle, yoksa oluştur.
      let hedefTripId = plan.tripId ?? null;

      if (hedefTripId) {
        // Bağlı Trip başkasına aitse taşımayı durdur — sessizce başka bir
        // kullanıcının kaydına yazmaktansa hata vermek doğru.
        const mevcut = await tx.trip.findUnique({
          where: { id: hedefTripId },
          select: { id: true, userId: true },
        });

        if (!mevcut) {
          hedefTripId = null;
        } else if (mevcut.userId !== userId) {
          throw new Error("Bağlı seyahat başka bir kullanıcıya ait");
        } else {
          await tx.trip.update({
            where: { id: hedefTripId },
            data: taslak.trip,
          });
        }
      }

      if (!hedefTripId) {
        const olusan = await tx.trip.create({
          data: { ...taslak.trip, userId },
          select: { id: true },
        });
        hedefTripId = olusan.id;
      }

      // 2. Yeniden taşımada eski türetilmiş kayıtlar temizleniyor.
      //    Yalnızca bu iki tablo: konaklama ve ulaşım kayıtları kullanıcı
      //    tarafından elle girilmiş olabilir, onlara dokunmuyoruz.
      if (secenekler.yenidenTasi) {
        await tx.budgetItem.deleteMany({ where: { tripId: hedefTripId } });
        await tx.dailyPlan.deleteMany({ where: { tripId: hedefTripId } });
      }

      // 3. Bütçe kalemleri
      if (taslak.budgetItems.length > 0) {
        await tx.budgetItem.createMany({
          data: taslak.budgetItems.map((kalem) => ({ ...kalem, tripId: hedefTripId })),
          skipDuplicates: true,
        });
      }

      // 4. Günlük planlar
      if (taslak.dailyPlans.length > 0) {
        await tx.dailyPlan.createMany({
          data: taslak.dailyPlans.map((gun) => ({
            tripId: hedefTripId,
            date: gun.date,
            title: gun.title,
            notes: gun.notes,
            activities: gun.activities as unknown as Prisma.InputJsonValue,
          })),
          // (tripId, date) tekil; çakışan gün sessizce atlanıyor.
          skipDuplicates: true,
        });
      }

      // 5. Damga ve bağ
      await tx.tripPlan.update({
        where: { id: planId },
        data: { tripId: hedefTripId, migratedAt: new Date() },
      });

      return hedefTripId;
    });

    logger.info("Plan ilişkisel modele taşındı", {
      planId,
      tripId,
      budgetItems: taslak.budgetItems.length,
      dailyPlans: taslak.dailyPlans.length,
      uyarilar: uyarilar.length,
    });

    return {
      planId,
      durum: "tasindi",
      tripId,
      uyarilar,
      sayilar: {
        budgetItems: taslak.budgetItems.length,
        dailyPlans: taslak.dailyPlans.length,
      },
    };
  } catch (error) {
    logger.error("Plan taşınamadı", error, { planId });
    return {
      planId,
      durum: "hata",
      hata: error instanceof Error ? error.message : "Bilinmeyen hata",
    };
  }
}

/**
 * Tüm planları (ya da tek bir kullanıcınınkileri) sırayla taşır.
 *
 * Bilinçli olarak SIRAYLA: her plan kendi transaction'ını açıyor ve paralel
 * çalıştırmak bağlantı havuzunu tüketiyor. Taşıma tek seferlik bir iş,
 * hızdan çok öngörülebilirlik önemli.
 */
export async function tumPlanlariTasi(
  secenekler: { userId?: string; limit?: number; yenidenTasi?: boolean } = {}
): Promise<TasimaOzeti> {
  const planlar = await prisma.tripPlan.findMany({
    where: {
      userId: secenekler.userId ?? { not: null },
      ...(secenekler.yenidenTasi ? {} : { migratedAt: null }),
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: secenekler.limit,
  });

  const ozet: TasimaOzeti = {
    toplam: planlar.length,
    tasindi: 0,
    atlandi: 0,
    zatenTasinmis: 0,
    hata: 0,
    sonuclar: [],
  };

  for (const { id } of planlar) {
    const sonuc = await planiTasi(id, { yenidenTasi: secenekler.yenidenTasi });
    ozet.sonuclar.push(sonuc);

    if (sonuc.durum === "tasindi") ozet.tasindi += 1;
    else if (sonuc.durum === "atlandi") ozet.atlandi += 1;
    else if (sonuc.durum === "zaten-tasinmis") ozet.zatenTasinmis += 1;
    else ozet.hata += 1;
  }

  logger.info("Toplu taşıma tamamlandı", {
    toplam: ozet.toplam,
    tasindi: ozet.tasindi,
    atlandi: ozet.atlandi,
    hata: ozet.hata,
  });

  return ozet;
}
