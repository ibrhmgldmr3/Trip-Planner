import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Middleware iki iş yapıyor: korumalı rotaların oturum kontrolü ve
 * nonce tabanlı içerik güvenlik politikası (CSP).
 */

/* -------------------------------------------------------------------------- */
/* Korumalı rotalar                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Oturum gerektiren sayfalar.
 *
 * Eskiden burada yalnızca "/profile" vardı. Oysa /my-plans, /budget,
 * /daily-planner, /manual-planner ve /ai-planner de oturum istiyor; onlar
 * kontrolü İSTEMCİDE yapıyordu. Sonuç: giriş yapmamış kullanıcı sayfayı
 * bir an görüyor, veri istekleri 401 dönüyor ve ancak ondan sonra login'e
 * yönlendiriliyordu.
 */
const KORUMALI_YOLLAR = [
  "/profile",
  "/my-plans",
  "/plan-detail",
  "/budget",
  "/daily-planner",
  "/manual-planner",
  "/ai-planner",
] as const;

/* -------------------------------------------------------------------------- */
/* İçerik güvenlik politikası                                                 */
/* -------------------------------------------------------------------------- */

/**
 * CSP neden şimdiye kadar yoktu ve şimdi nasıl mümkün oldu:
 *
 * Harita sayfası Google Maps JS API'sini runtime'da `<script>` enjekte
 * ederek yüklüyor, layout da tema seçimini hydration öncesi uygulayan bir
 * satır-içi script taşıyor. `'unsafe-inline'` içeren bir CSP hiçbir koruma
 * sağlamayacağı için politika bilinçli olarak yazılmamıştı.
 *
 * Çözüm nonce + `strict-dynamic`:
 *  - Her istekte rastgele bir nonce üretiliyor.
 *  - Next.js, istek başlığındaki CSP'den nonce'u okuyup KENDİ script'lerine
 *    otomatik ekliyor; layout'taki satır-içi script'e de elle veriyoruz.
 *  - `strict-dynamic` sayesinde nonce'lu bir script'in yüklediği script'ler
 *    (Maps API'si böyle geliyor) güvenilir sayılıyor. Böylece harita
 *    çalışmaya devam ediyor ama sayfaya enjekte edilen keyfi bir script
 *    çalışmıyor.
 *  - `https:` ve `'unsafe-inline'` yalnızca `strict-dynamic` desteklemeyen
 *    eski tarayıcılar için yedek; destekleyen tarayıcılar ikisini de yok
 *    sayıyor.
 *
 * BEDELİ: nonce her istekte değiştiği için kök layout onu `headers()` ile
 * okumak zorunda; bu da Next.js'te TÜM SAYFALARI statik üretimden dinamik
 * render'a çeviriyor (build çıktısında ○ → ƒ). Bilinçli bir takas:
 * uygulamanın değerli sayfalarının hepsi zaten oturum arkasında ve dinamik;
 * statik kalan yalnızca /terms, /privacy ve ana sayfaydı. Buna karşılık
 * LLM'in ürettiği HTML `dangerouslySetInnerHTML` ile basılıyor — XSS burada
 * teorik bir risk değil. Statik üretimi geri istiyorsanız tek yol nonce'tan
 * vazgeçmek, o da script CSP'sini anlamsızlaştırır.
 *
 * VARSAYILAN: ÜRETİMDE ZORLA, GELİŞTİRMEDE RAPOR ET.
 *
 * Politika bir süre rapor modunda izlendi ve ÖLÇÜLDÜ (4 Eylül 2026):
 * gezilen sayfalarda (ana sayfa, giriş, harita, planlar, bütçe, günlük
 * plan) tek bir ihlal SINIFI çıktı — `unsafe-eval`. Google Maps script'i,
 * fontlar, görseller, `connect-src`, `style-src`, `frame-src`: hiçbiri
 * ihlal üretmedi. Yani politika uygulamaya hazır.
 *
 * `unsafe-eval` ihlalleri UYGULAMADAN GELMİYOR: Next.js dev sunucusu
 * webpack'in `eval` tabanlı kaynak haritalarını kullanıyor. Üretim
 * derlemesinde durum farklı ve bu da ölçüldü — `.next/static/chunks`
 * içinde `eval(` ve `new Function(` sayısı SIFIR.
 *
 * Bu yüzden mod ortama göre ayrılıyor:
 *   üretim      → `Content-Security-Policy` (zorlanıyor)
 *   geliştirme  → `Content-Security-Policy-Report-Only`
 *
 * Geliştirmede zorlamak, webpack'in `eval`ini bloklayıp uygulamayı yerelde
 * tamamen çalışmaz hale getirirdi.
 *
 * `CSP_MODE` İKİ YÖNDE DE geçersiz kılıyor:
 *   CSP_MODE=enforce  → her ortamda zorla (yerelde politikayı denemek için)
 *   CSP_MODE=report   → her ortamda rapor et (üretimde bir şey kırılırsa
 *                       kod değişikliği olmadan geri dönüş yolu)
 */
/**
 * Politika zorlanacak mı, yalnızca raporlanacak mı?
 *
 * Ayrı bir fonksiyon: karar tek satırlık bir koşuldan fazlası ve
 * testlenebilir olması gerekiyor (bkz. tests/csp.test.ts).
 */
export function cspZorlanacakMi(
  ortam: string | undefined = process.env.NODE_ENV,
  mod: string | undefined = process.env.CSP_MODE
): boolean {
  const normal = (mod ?? "").trim().toLowerCase();
  if (normal === "enforce") return true;
  if (normal === "report" || normal === "report-only") return false;
  return ortam === "production";
}

function cspUret(nonce: string, zorla: boolean): string {
  const yonergeler = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    // Maps ve Tailwind satır-içi stil üretiyor; stil enjeksiyonunun risk
    // yüzeyi script'e göre çok dar.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    // Maps kutucukları ve marker'ları gstatic'ten geliyor.
    `img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com`,
    `connect-src 'self' https://*.googleapis.com https://*.gstatic.com`,
    `frame-src 'self' https://*.google.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    // X-Frame-Options'ın modern karşılığı; ikisi birlikte duruyor.
    `frame-ancestors 'none'`,
  ];

  // `upgrade-insecure-requests` rapor modunda hiçbir şey yapmıyor ve
  // tarayıcı bunun için konsola uyarı basıyor. Gürültülü bir konsol gerçek
  // hataları saklar; direktifi yalnızca zorlama modunda gönderiyoruz.
  if (zorla) yonergeler.push(`upgrade-insecure-requests`);

  return yonergeler.join("; ");
}

/** Kriptografik olarak güvenli, base64 kodlu nonce. */
function nonceUret(): string {
  const bayt = new Uint8Array(16);
  crypto.getRandomValues(bayt);
  return btoa(String.fromCharCode(...bayt));
}

/* -------------------------------------------------------------------------- */

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // startsWith kontrolü alt yolları da kapsıyor (/profile/my-trips gibi).
  const korumaliMi = KORUMALI_YOLLAR.some(
    (korumali) => path === korumali || path.startsWith(`${korumali}/`)
  );

  if (korumaliMi) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const url = new URL("/login", request.url);
      // callbackUrl'e TAM URL değil, yalnızca uygulama içi yol yazılıyor.
      // Tam URL yazmak açık yönlendirme (open redirect) yüzeyi açar.
      url.searchParams.set("callbackUrl", `${path}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
  }

  const nonce = nonceUret();
  const zorla = cspZorlanacakMi();
  const csp = cspUret(nonce, zorla);
  const cspBasligi = zorla
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";

  // Nonce'u İSTEK başlığına da yazıyoruz: Next.js kendi script etiketlerine
  // nonce eklemek için buradan okuyor, layout da `headers()` ile alıyor.
  const istekBasliklari = new Headers(request.headers);
  istekBasliklari.set("x-nonce", nonce);
  istekBasliklari.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: istekBasliklari },
  });

  response.headers.set(cspBasligi, csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * CSP tüm sayfalarda gerekli olduğu için middleware artık her yolda
     * çalışıyor; aşağıdakiler dışarıda:
     *   - /api      → JSON döndürüyor, CSP'nin anlamı yok
     *   - _next/*   → derlenmiş varlıklar
     *   - dosya adı uzantısı olan istekler (favicon.ico, *.svg, *.webp)
     */
    {
      source: "/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
