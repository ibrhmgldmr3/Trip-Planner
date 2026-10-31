import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-session";
import { rateLimitAsync } from "@/lib/rate-limit";
import { zenginRotaHesapla } from "@/lib/ulasim-arama";
import { sehirBul } from "@/lib/seyahat-mesafe";
import { transportOptionsQuerySchema, ilkHataMesaji } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";

/**
 * `GET /api/transport-options?from=İstanbul&to=Van`
 *
 * İki şehir arasındaki ulaşım seçeneklerini döndürür: mesafeden hesaplanmış
 * süre/maliyet TAHMİNLERİ ve (anahtar varsa) web aramasından gelen gerçek
 * satış siteleri.
 *
 * NEDEN SUNUCUDA: Tavily anahtarı sunucu tarafı bir sır; tarayıcıya
 * verilemez. Ayrıca arama kotalı — kimlik doğrulaması ve hız sınırı burada.
 *
 * NEDEN GET: yan etkisi yok, aynı girdi aynı çıktıyı veriyor; tarayıcı ve
 * ara katmanlar önbelleğe alabilsin.
 */

/** Arama kotasını korur: kullanıcı başına dakikada 12 rota sorgusu. */
const SINIR = 12;
const PENCERE_MS = 60_000;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const cozum = transportOptionsQuerySchema.safeParse({
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
      // Varsayılan true; istemci ?web=0 ile yalnızca tahmin isteyebilir.
      web: url.searchParams.get("web") ?? "1",
    });

    if (!cozum.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(cozum.error, "Geçersiz güzergâh") },
        { status: 400 }
      );
    }

    const { from, to, web } = cozum.data;

    // Karşılaştırma ÇÖZÜMLENMİŞ şehirler üzerinden yapılıyor, ham metin
    // üzerinden değil.
    //
    // NEDEN: Türkçe küçültme kuralı "I"yı "ı"ya çeviriyor, yani
    // `"Istanbul".toLocaleLowerCase("tr")` → "ıstanbul" ve bu, kullanıcının
    // öbür alana yazdığı "İstanbul"un küçük hâli olan "istanbul" ile
    // EŞLEŞMİYOR. Metin karşılaştırması iki alanı "farklı şehir" sayıyor,
    // ardından `rotaHesapla` ikisini de aynı şehre çözüyor ve arayüze
    // hatasız ama BOŞ bir seçenek listesi dönüyordu — kullanıcı neyin
    // yanlış olduğunu göremiyordu. `sehirBul` aynı ASCII indirgemesini
    // zaten yapıyor (bkz. src/lib/seyahat-mesafe.ts).
    const neredenSehir = sehirBul(from);
    const nereyeSehir = sehirBul(to);

    if (!neredenSehir || !nereyeSehir) {
      return NextResponse.json(
        { error: "Şehirlerden biri tanınmadı. Listeden seçim yapın." },
        { status: 404 }
      );
    }

    if (neredenSehir.ad === nereyeSehir.ad) {
      return NextResponse.json(
        { error: "Kalkış ve varış şehri aynı olamaz" },
        { status: 400 }
      );
    }

    // Hız sınırı YALNIZCA web araması istendiğinde: tahmin hesabı yerel ve
    // bedava, onu kısıtlamak için sebep yok.
    if (web) {
      const limit = await rateLimitAsync(`transport-options:${auth.user.id}`, SINIR, PENCERE_MS);
      if (!limit.success) {
        return NextResponse.json(
          {
            error: `Çok fazla arama yaptınız. ${limit.retryAfter} saniye sonra tekrar deneyin.`,
          },
          { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
        );
      }
    }

    const rota = await zenginRotaHesapla(from, to, { webAra: web });

    if (!rota) {
      return NextResponse.json(
        { error: "Şehirlerden biri tanınmadı. Listeden seçim yapın." },
        { status: 404 }
      );
    }

    return NextResponse.json({ rota });
  } catch (error) {
    // Ayrıntı yalnızca sunucu log'una; istemciye stack trace sızdırmıyoruz.
    logger.error("Ulaşım seçenekleri hesaplanamadı", error);
    return NextResponse.json(
      { error: "Ulaşım seçenekleri hesaplanamadı" },
      { status: 500 }
    );
  }
}
