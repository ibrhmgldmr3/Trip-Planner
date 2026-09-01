import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TripStatus,
  canTransition,
  transitionError,
} from "@/lib/trip-status";
import { logger } from "@/lib/logger";

/**
 * Plan durumu değiştirmenin TEK uygulaması.
 *
 * NEDEN VAR: aynı iş iki ayrı uçta, iki farklı şekilde yapılıyordu:
 *
 *   PATCH /api/trip-plans/[id]/status  → completedAt yazıyor, DONE olunca
 *                                        Trip kaydı açıyordu
 *   PUT   /api/plan-status             → yalnızca status yazıyordu
 *
 * Sonuç: planı "Gerçekleşti"ye çeviren istemci hangi ucu çağırdığına göre
 * ya Gezilerim'de görünüyor ya görünmüyordu; `completedAt` de yarı yarıya
 * doluydu. Önce ikisi de buraya deleg ettirildi, Aşama 1'de ikinci uç
 * (`PUT /api/plan-status`) tamamen kaldırıldı. Tek kanonik uç:
 * `PATCH /api/trip-plans/[id]/status`.
 *
 * Ayrıca geçiş kuralları SUNUCUDA zorlanıyor. Arayüzdeki `canCancel` /
 * `canMarkAsDone` yalnızca butonu gizliyordu; doğrudan API'ye atılan bir
 * istek iptal edilmiş bir planı tekrar "Planlandı"ya çevirebiliyordu.
 */

export type StatusUpdateResult =
  | { ok: true; plan: Awaited<ReturnType<typeof prisma.tripPlan.update>> }
  | { ok: false; response: NextResponse };

export async function planDurumunuGuncelle(
  planId: string,
  userId: string,
  yeniDurum: TripStatus
): Promise<StatusUpdateResult> {
  const mevcut = await prisma.tripPlan.findFirst({
    where: { id: planId, userId },
    select: {
      id: true,
      status: true,
      tripId: true,
      city: true,
      country: true,
      startDate: true,
      endDate: true,
      total_cost: true,
      sehir_bilgisi: true,
    },
  });

  if (!mevcut) {
    // "Yok" ile "senin değil" ayrımını yapmıyoruz: ayrım, id bilen birine
    // planın varlığını doğrular.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
      ),
    };
  }

  const oncekiDurum = mevcut.status as TripStatus;

  if (!canTransition(oncekiDurum, yeniDurum)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: transitionError(oncekiDurum, yeniDurum) },
        { status: 409 }
      ),
    };
  }

  const plan = await prisma.tripPlan.update({
    where: { id: planId },
    data: {
      status: yeniDurum,
      // completedAt yalnızca DONE'da anlamlı; başka duruma geçişte
      // temizleniyor ki eski bir tarih ortada kalmasın.
      completedAt: yeniDurum === TripStatus.DONE ? new Date() : null,
    },
  });

  // DONE olan bir plan "Gezilerim" listesine (Trip tablosu) yansıtılıyor.
  // Yalnızca daha önce bağlanmamış planlar için; aksi halde her DONE
  // işaretlemesinde yeni bir gezi kaydı üretilir.
  if (yeniDurum === TripStatus.DONE && !mevcut.tripId) {
    try {
      // Tarihler eksikse ya da ters girilmişse geçerli bir aralık üret:
      // Trip.startDate/endDate zorunlu ve endDate < startDate anlamsız.
      const baslangic = mevcut.startDate ?? new Date();
      const bitis =
        mevcut.endDate && mevcut.endDate >= baslangic ? mevcut.endDate : baslangic;

      const trip = await prisma.trip.create({
        data: {
          title: `${mevcut.city} Gezisi`,
          description: mevcut.sehir_bilgisi || "",
          startDate: baslangic,
          endDate: bitis,
          userId,
          city: mevcut.city,
          country: mevcut.country || "",
          budget: mevcut.total_cost,
          status: TripStatus.DONE,
        },
      });

      await prisma.tripPlan.update({
        where: { id: planId },
        data: { tripId: trip.id },
      });
    } catch (error) {
      // Gezi kaydı açılamadıysa durum değişikliğini geri almıyoruz; plan
      // yine DONE. Kullanıcı için önemli olan durum, gezi kaydı türetilmiş
      // veri — hatayı log'layıp devam ediyoruz.
      logger.error("Tamamlanan plan Gezilerim'e eklenemedi", error, { planId });
    }
  }

  logger.info("Plan durumu güncellendi", {
    planId,
    oncekiDurum,
    yeniDurum,
  });

  return { ok: true, plan };
}
