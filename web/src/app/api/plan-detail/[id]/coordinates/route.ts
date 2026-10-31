import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { rateLimitAsync } from "@/lib/rate-limit";
import { gunleriCoz } from "@/lib/plan-budget";
import { geocodingYapilandirilmisMi, gunlereKoordinatEkle } from "@/lib/geocoding";
import { logger } from "@/lib/logger";
import {
  gunAktivitelerineYaz,
  iliskiselGunPlaniJson,
  tasinmisTripId,
} from "@/lib/iliskisel-plan-ozeti";

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
 *
 * İKİ YOL (B4 · Adım 5): plan taşınmışsa günler `DailyPlan` satırlarından
 * okunup oraya geri yazılıyor. `TripPlan.gun_plani` taşınmış planlarda
 * SALT OKUNUR ARŞİV; oraya yazılan koordinat hiçbir ekranda görünmezdi.
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

    // Sahiplik sorgunun içinde; "yok" ile "senin değil" ayrımı YAPILMIYOR
    // (bkz. src/lib/trip-ownership.ts — 403 dönmek id'yi bilen birine
    // planın var olduğunu doğrular).
    const plan = await prisma.tripPlan.findFirst({
      where: { id: planId, userId: auth.user.id },
      select: {
        city: true,
        country: true,
        gun_plani: true,
        tripId: true,
        migratedAt: true,
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 });
    }

    const tripId = tasinmisTripId(plan);

    // Taşınmış planda gün planı ilişkisel satırlardan türetiliyor; satır
    // yoksa arşive düşülüyor (taşımada boş gün kaydı üretilmemiş olabilir).
    const iliskiselGunler = tripId ? await iliskiselGunPlaniJson(tripId) : null;
    const hamGunler = iliskiselGunler ?? plan.gun_plani;

    const gunler = gunleriCoz(hamGunler);
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
      // YAZILACAK YER, OKUNAN YER. Yalnızca taşınma damgasına bakmak
      // yetmiyordu: satırı olmayan taşınmış bir planda günler arşivden
      // okunuyor, sonuç ise ilişkisel tabloya yazılmaya çalışılıyor ve
      // eşleşecek satır olmadığı için ÇÖZÜLEN KOORDİNATLAR SESSİZCE
      // KAYBOLUYORDU.
      if (tripId && iliskiselGunler) {
        await gunAktivitelerineYaz(tripId, sonuc.gunler);
      } else {
        await prisma.tripPlan.update({
          where: { id: planId },
          data: { gun_plani: JSON.stringify(sonuc.gunler) },
        });
      }
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
