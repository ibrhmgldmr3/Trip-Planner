import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { rateLimitAsync } from "@/lib/rate-limit";
import { gunleriCoz } from "@/lib/plan-budget";
import { geocodingYapilandirilmisMi, gunlereKoordinatEkle } from "@/lib/geocoding";
import { logger } from "@/lib/logger";

/**
 * Mevcut bir planın aktivitelerine koordinat ekler (Faz D).
 *
 * NEDEN AYRI BİR UÇ: bu özellikten ÖNCE üretilmiş planlar koordinatsız ve
 * harita sayfasının "Plan Rotası" modu onlar için boş kalıyor. Bu uç tek
 * seferlik bir tamamlama düğmesi.
 *
 * NEDEN `PUT /api/plan-detail/[id]` DEĞİL: o handler gün planını
 * kaydederken bütçenin "aktiviteler" kategorisini gün aktivitelerinden
 * YENİDEN YAZIYOR. Kullanıcı yalnızca haritada rota görmek isterken
 * bütçesinin sessizce değişmesi kabul edilemez bir yan etki olurdu. Bu uç
 * SADECE `gun_plani` sütununa dokunuyor.
 *
 * NEDEN GÖVDE ALMIYOR: koordinatlar istemciden değil, sunucudan (Google
 * Geocoding) geliyor. İstemcinin gönderdiği koordinata güvenmek, bir
 * kullanıcının kendi planına rastgele noktalar yazabilmesi demekti;
 * ayrıca tarayıcı anahtarının Places kotasını harcamıyoruz.
 */

/** Geocoding ücretli; kullanıcı başına saatlik üst sınır. */
const SAATLIK_LIMIT = Number(process.env.GEOCODE_RATE_LIMIT_PER_HOUR) || 10;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;

    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    if (!geocodingYapilandirilmisMi()) {
      return NextResponse.json(
        { error: "Konum çözümleme bu sunucuda yapılandırılmamış" },
        { status: 503 }
      );
    }

    // IP değil oturum kimliğiyle sınırlıyoruz: maliyet kullanıcı başına
    // oluşuyor ve IP başlıkları proxy arkasında taklit edilebilir.
    const quota = await rateLimitAsync(
      `geocode:${auth.user.id}`,
      SAATLIK_LIMIT,
      60 * 60 * 1000
    );

    if (!quota.success) {
      return NextResponse.json(
        { error: "Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(quota.retryAfter) } }
      );
    }

    const plan = await prisma.tripPlan.findUnique({
      where: { id: planId },
      select: { userId: true, city: true, country: true, gun_plani: true },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 });
    }

    if (plan.userId !== auth.user.id) {
      return NextResponse.json({ error: "Bu plana erişim yetkiniz yok" }, { status: 403 });
    }

    const gunler = gunleriCoz(plan.gun_plani);
    if (!gunler) {
      // Eski markdown planlar; çözülecek yapılandırılmış aktivite yok.
      return NextResponse.json(
        { error: "Bu planın gün planı koordinat eklenebilecek biçimde değil" },
        { status: 400 }
      );
    }

    const sonuc = await gunlereKoordinatEkle(gunler, {
      city: plan.city,
      country: plan.country,
    });

    // Hiçbir yeni koordinat çözülemediyse yazma yapmıyoruz: gereksiz bir
    // UPDATE `updatedAt`i kaydırır ve planı "değişmiş" gösterirdi.
    if (sonuc.cozulen > 0) {
      await prisma.tripPlan.update({
        where: { id: planId },
        data: { gun_plani: JSON.stringify(sonuc.gunler) },
      });
    }

    logger.info("Plan koordinatları güncellendi", {
      planId,
      cozulen: sonuc.cozulen,
      cozulemeyen: sonuc.cozulemeyen,
    });

    return NextResponse.json({
      success: true,
      cozulen: sonuc.cozulen,
      cozulemeyen: sonuc.cozulemeyen,
    });
  } catch (error: unknown) {
    logger.error("Plan koordinatları güncellenemedi", error);

    return NextResponse.json(
      { error: "Konumlar çözülemedi" },
      { status: 500 }
    );
  }
}
