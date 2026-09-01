import { NextRequest, NextResponse, after } from "next/server";
import { requireUser } from "@/lib/auth-session";
import { rateLimitAsync } from "@/lib/rate-limit";
import { planRequestSchema, ilkHataMesaji } from "@/lib/api-schemas";
import { tarihiCoz } from "@/lib/trip-dates";
import { calistir, devamEdenIs, isOlustur } from "@/lib/plan-job";
import { logger } from "@/lib/logger";

/**
 * AI plan üretimini BAŞLATIR.
 *
 * DEĞİŞEN SÖZLEŞME (Aşama 3): bu uç artık planı döndürmüyor. Bir iş kaydı
 * açıp `202 Accepted` + `jobId` dönüyor; üretim yanıt gönderildikten sonra
 * `after()` içinde sürüyor ve istemci `GET /api/plan-jobs/[id]` ile durumu
 * sorguluyor.
 *
 * NEDEN: üretim en kötü durumda 2 model × 3 strateji + onarım + markdown
 * yedeği = 8 ardışık LLM çağrısı ve 240 saniye. O süre boyunca bir HTTP
 * bağlantısını açık tutmak bir zaman aşımı ayarı meselesi değil, mimari bir
 * sınırdı: kullanıcı sekmeyi kapatınca iş çöpe gidiyor, yeniden denemenin
 * yolu bulunmuyor ve bir sunucu işçisi boşuna meşgul ediliyordu.
 *
 * Üretim mantığı `src/lib/plan-generation.ts` içine TAŞINDI, değişmedi.
 */

// İş `after()` içinde ama aynı çağrı bağlamında çalışıyor; platformun
// fonksiyon süresi üretim zincirini kapsamalı.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // Ücretli bir LLM zinciri başlatılıyor: önce kimlik, sonra kota.
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    const quota = await rateLimitAsync(`trip-plan:${userId}`, 5, 60 * 60 * 1000);
    if (!quota.success) {
      return NextResponse.json(
        {
          error: `Saatlik plan oluşturma limitine ulaştınız. ${Math.ceil(
            quota.retryAfter / 60
          )} dakika sonra tekrar deneyin.`,
        },
        { status: 429, headers: { "Retry-After": String(quota.retryAfter) } }
      );
    }

    // Aynı anda ikinci bir üretim başlatmak hem kotayı hem sağlayıcı
    // maliyetini boşa harcıyor; kullanıcı "bir şey olmadı" sanıp tekrar
    // tıkladığında mevcut işe bağlanıyor.
    const mevcut = await devamEdenIs(userId);
    if (mevcut) {
      return NextResponse.json(
        {
          success: true,
          jobId: mevcut.id,
          status: mevcut.status,
          statusUrl: `/api/plan-jobs/${mevcut.id}`,
          message: "Zaten devam eden bir plan üretimi var",
        },
        { status: 202 }
      );
    }

    const parsed = planRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Geçersiz istek") },
        { status: 400 }
      );
    }

    const { startDate, endDate } = parsed.data;

    // Tarih doğrulaması üretimden ÖNCE: geçersiz tarihle üretilen bir plan
    // hiçbir ekranda doğru görünmüyor, üstelik LLM maliyeti boşa gidiyor.
    if (startDate && endDate) {
      const start = tarihiCoz(startDate);
      const end = tarihiCoz(endDate);

      if (!start || !end) {
        return NextResponse.json(
          { error: "Geçersiz tarih formatı" },
          { status: 400 }
        );
      }

      if (end < start) {
        return NextResponse.json(
          { error: "Bitiş tarihi başlangıç tarihinden önce olamaz" },
          { status: 400 }
        );
      }
    }

    const is = await isOlustur(userId, parsed.data);

    // `after()` yanıt gönderildikten SONRA çalışıyor. `calistir` hiçbir
    // zaman fırlatmıyor: burada yakalanmayan bir hata sessizce kaybolur ve
    // iş sonsuza kadar RUNNING kalırdı.
    after(() => calistir(is.id));

    logger.info("Plan üretim işi kuyruğa alındı", { jobId: is.id });

    return NextResponse.json(
      {
        success: true,
        jobId: is.id,
        status: is.status,
        statusUrl: `/api/plan-jobs/${is.id}`,
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    logger.error("Plan üretimi başlatılamadı", error);

    return NextResponse.json(
      { error: "Plan üretimi başlatılamadı" },
      { status: 500 }
    );
  }
}
