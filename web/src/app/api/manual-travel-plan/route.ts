import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { rateLimitAsync } from "@/lib/rate-limit";
import { manualPlanSchema, ilkHataMesaji } from "@/lib/api-schemas";
import { gunSayisi, isoGunTarihi, gunlukOrtalama, tarihiCoz } from "@/lib/trip-dates";
import { logger } from "@/lib/logger";

/**
 * Manuel plan kaydı.
 *
 * Bu dosyada düzeltilen sorunlar:
 *  1. Uç KİMLİK DOĞRULAMASIZDI. Herkes POST atıp veritabanına satır
 *     yazabiliyordu (userId null kalıyor, plan hiçbir kullanıcıya
 *     görünmüyor ama tabloda birikiyordu).
 *  2. Gövde hiç doğrulanmıyordu; `planData.basicInfo.destination` erişimi
 *     `basicInfo` yoksa TypeError fırlatıyor, catch bloğu da yanıtta
 *     `error.stack` döndürüyordu.
 *  3. Süre `Math.ceil((end - start) / GUN)` ile DIŞLAYICI hesaplanıyordu;
 *     1-5 Ocak seyahati 4 gün sayılıyor ve `daily_cost` şişiyordu.
 *  4. Bitiş tarihi başlangıçtan önce olabiliyordu; `duration` negatif
 *     çıkınca `daily_cost` de negatif kaydediliyordu.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    // Yazma ucu: kullanıcı başına makul bir tavan.
    const quota = await rateLimitAsync(`manual-plan:${userId}`, 30, 60 * 60 * 1000);
    if (!quota.success) {
      return NextResponse.json(
        { error: "Çok fazla plan kaydettiniz, bir süre sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(quota.retryAfter) } }
      );
    }

    const parsed = manualPlanSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Plan bilgileri geçersiz") },
        { status: 400 }
      );
    }

    const planData = parsed.data;
    const { basicInfo, budget } = planData;

    const startDate = tarihiCoz(basicInfo.startDate);
    const endDate = tarihiCoz(basicInfo.endDate);

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Geçersiz tarih formatı" }, { status: 400 });
    }

    if (endDate < startDate) {
      return NextResponse.json(
        { error: "Bitiş tarihi başlangıç tarihinden önce olamaz" },
        { status: 400 }
      );
    }

    const duration = gunSayisi(startDate, endDate);
    const estimatedTotal = Math.max(0, Math.round(budget.estimatedTotal));

    // Günlük planlara tarih ekleyip tüketicilerin (daily-planner, plan-detail)
    // beklediği şekle getiriyoruz; bu iki sayfa `date` alanını okuyor.
    const gunler = planData.dailyPlans.map((day, index) => ({
      day: day.day > 0 ? day.day : index + 1,
      date: isoGunTarihi(startDate, index),
      activities: day.activities,
      notes: day.notes,
      isEmpty: day.activities.length === 0,
    }));

    // Bütçe, plan-detail ve budget sayfalarının tanıdığı kategori şekline
    // çevriliyor. Eskiden ham `breakdown` objesi yazılıyordu; o şekilde
    // `categories` anahtarı olmadığı için iki sayfa da kalemleri gösteremiyordu.
    const kategoriAdlari: Record<keyof typeof budget.breakdown, string> = {
      transport: "ulaşım",
      accommodation: "konaklama",
      activities: "aktiviteler",
      food: "yemek",
      other: "diğer",
    };

    const categories: Record<
      string,
      { items: Array<{ description: string; amount: number; isPaid: boolean }>; total: number }
    > = {};

    for (const [anahtar, tutar] of Object.entries(budget.breakdown)) {
      const ad = kategoriAdlari[anahtar as keyof typeof budget.breakdown];
      const miktar = Math.max(0, Math.round(tutar));
      categories[ad] = {
        items: miktar > 0 ? [{ description: `${ad} (manuel)`, amount: miktar, isPaid: false }] : [],
        total: miktar,
      };
    }

    const kategoriToplami = Object.values(categories).reduce((sum, c) => sum + c.total, 0);
    const toplam = estimatedTotal > 0 ? estimatedTotal : kategoriToplami;
    const gunlukMaliyet = gunlukOrtalama(toplam, duration);

    const butceJson = {
      categories,
      currency: "TRY",
      extraItemsTotal: 0,
      totalCostWithExtras: toplam,
      suggestedBudget: Math.round(toplam * 1.2),
      dailyAverage: gunlukMaliyet,
    };

    const savedPlan = await prisma.tripPlan.create({
      data: {
        city: basicInfo.destination,
        country: basicInfo.country || null,
        startDate,
        endDate,
        duration: `${duration} gün`,

        gun_plani: JSON.stringify(gunler),

        // Seçilen hizmetler ham JSON olarak saklanıyor (geriye uyumluluk).
        transportation: planData.transport ? JSON.stringify(planData.transport) : null,
        accommodation: planData.accommodation ? JSON.stringify(planData.accommodation) : null,

        total_cost: toplam,
        daily_cost: gunlukMaliyet,
        budget_level: basicInfo.travelStyle || null,

        ai_model: "manual_planning",
        raw_markdown: [
          `# ${basicInfo.destination} Seyahat Planı`,
          `## Tarih: ${basicInfo.startDate} - ${basicInfo.endDate}`,
          `## Kişi Sayısı: ${basicInfo.travelers}`,
          `## Toplam Maliyet: ₺${toplam.toLocaleString("tr-TR")}`,
        ].join("\n\n"),

        travel_style: basicInfo.travelStyle || null,
        interests: JSON.stringify(["manuel_planlama"]),

        sehir_bilgisi: `Manuel olarak planlanmış ${basicInfo.destination} seyahati`,
        pratik_bilgiler: `${basicInfo.travelers} kişi için ${duration} günlük plan`,
        butce_tahmini: JSON.stringify(butceJson),

        // Sahiplik yalnızca userId üzerinden. `userEmail` sütunu
        // 20260831 migration'ında düşürüldü.
        userId,
      },
    });

    logger.info("Manuel plan kaydedildi", { planId: savedPlan.id });

    return NextResponse.json({
      success: true,
      planId: savedPlan.id,
      message: "Seyahat planınız başarıyla kaydedildi!",
      plan: {
        id: savedPlan.id,
        destination: basicInfo.destination,
        duration,
        totalCost: toplam,
        createdAt: savedPlan.createdAt,
      },
    });
  } catch (error: unknown) {
    // Ayrıntı yalnızca sunucu log'una; istemciye stack trace sızdırmıyoruz.
    logger.error("Manuel plan kaydedilemedi", error);

    return NextResponse.json(
      { error: "Plan kaydedilirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
