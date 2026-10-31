import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-session";
import { rateLimitAsync } from "@/lib/rate-limit";
import { arama, aramaYapilandirilmisMi, otelAramaSorgusu } from "@/lib/web-search";
import {
  accommodationOptionsQuerySchema,
  ilkHataMesaji,
} from "@/lib/api-schemas";
import { logger } from "@/lib/logger";

/**
 * `GET /api/accommodation-options?city=Roma&checkIn=2026-11-02`
 *
 * Bir şehirdeki konaklama fiyatları hakkında GERÇEK arama sonuçları döndürür.
 *
 * NE DEĞİL: bu bir rezervasyon API'si değil. Oda müsaitliği, kesin gecelik
 * fiyat ya da rezervasyon yapma imkânı YOK. Dönen şey, konaklama fiyatları
 * hakkında yazan sitelerin bağlantıları — kullanıcı güncel fiyatı oradan
 * görüyor.
 *
 * NEDEN BÖYLE: konaklama ekranı bu ana kadar tamamen SABİT DEMO VERİYLE
 * çalışıyordu — beş uydurma otel, uydurma yıldız ve fiyat. Gerçek fiyat
 * için bir tedarikçi sözleşmesi (Booking/Amadeus) gerekiyor ve bu ayrı bir
 * ürün/maliyet kararı. Arada kalan dürüst seçenek: zaten kurulu olan arama
 * sağlayıcısını kullanmak ve sonucun ne olduğunu açıkça söylemek.
 *
 * NEDEN SUNUCUDA: Tavily anahtarı sunucu tarafı bir sır ve arama kotalı.
 * Kimlik doğrulaması ve hız sınırı burada.
 *
 * Sorgu metni `web-search.ts`'ten geliyor; modele sunulan `get_hotel_prices`
 * aracıyla AYNI sorguyu kuruyor. Metin gerçek sonuçlarla ayarlandığı için
 * kopyalanmıyor.
 */

/** Arama kotasını korur: kullanıcı başına dakikada 12 sorgu. */
const SINIR = 12;
const PENCERE_MS = 60_000;

/** Konaklama fiyatı aramasında işe yaramayan alan adları. */
const ELENEN_ALANLAR = [
  "instagram.com", "facebook.com", "x.com", "twitter.com", "tiktok.com",
  "youtube.com", "pinterest.com", "reddit.com", "linkedin.com",
];

function alanAdi(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function kullanilabilirMi(url: string): boolean {
  const alan = alanAdi(url);
  return !ELENEN_ALANLAR.some((e) => alan === e || alan.endsWith("." + e));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const cozum = accommodationOptionsQuerySchema.safeParse({
      city: url.searchParams.get("city") ?? "",
      checkIn: url.searchParams.get("checkIn") ?? undefined,
      checkOut: url.searchParams.get("checkOut") ?? undefined,
      budgetLevel: url.searchParams.get("budgetLevel") ?? undefined,
    });

    if (!cozum.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(cozum.error, "Geçersiz arama") },
        { status: 400 }
      );
    }

    // Arama yapılandırılmamışsa bunu AÇIKÇA söylüyoruz. Boş liste dönmek
    // "bu şehir için sonuç yok" gibi okunur ve kullanıcı boşuna arar.
    if (!aramaYapilandirilmisMi()) {
      return NextResponse.json(
        {
          yapilandirildi: false,
          sorgu: "",
          kaynaklar: [],
        },
        { status: 200 }
      );
    }

    const limit = await rateLimitAsync(
      `accommodation-options:${auth.user.id}`,
      SINIR,
      PENCERE_MS
    );
    if (!limit.success) {
      return NextResponse.json(
        {
          error: `Çok fazla arama yaptınız. ${limit.retryAfter} saniye sonra tekrar deneyin.`,
        },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const { city, checkIn, budgetLevel } = cozum.data;
    const sorgu = otelAramaSorgusu(city, checkIn, budgetLevel);

    const bulunan = await arama(sorgu, 8);

    // Aynı alan adından ikinci bir sonuç göstermenin faydası yok.
    const gorulen = new Set<string>();
    const kaynaklar = bulunan
      .filter((s) => kullanilabilirMi(s.url))
      .filter((s) => {
        const alan = alanAdi(s.url);
        if (gorulen.has(alan)) return false;
        gorulen.add(alan);
        return true;
      })
      .slice(0, 6)
      .map((s) => ({
        baslik: s.title || alanAdi(s.url),
        url: s.url,
        ozet: s.snippet,
        alan: alanAdi(s.url),
      }));

    logger.debug("Konaklama seçenekleri arandı", { sonuc: kaynaklar.length });

    return NextResponse.json({ yapilandirildi: true, sorgu, kaynaklar });
  } catch (error) {
    logger.error("Konaklama seçenekleri alınamadı", error);
    return NextResponse.json(
      { error: "Konaklama seçenekleri alınamadı" },
      { status: 500 }
    );
  }
}
