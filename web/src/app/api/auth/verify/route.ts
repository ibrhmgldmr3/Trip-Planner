import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, clientIp } from "@/lib/rate-limit";
import { epostaDogrulamaSchema, ilkHataMesaji } from "@/lib/api-schemas";
import { JETON_AMACLARI, jetonuTuket } from "@/lib/dogrulama-jetonu";
import { logger } from "@/lib/logger";

/**
 * E-posta doğrulamasını tamamlar (B9).
 *
 * `User.emailVerified` sütunu şemada baştan beri vardı ve HİÇ
 * YAZILMIYORDU. Doğrulama, plan üretim kotasını belirliyor: doğrulanmamış
 * hesapta saatlik hak 1, doğrulanmışta 5 (bkz. api/trip-plan-model).
 *
 * NEDEN TAMAMEN ENGELLEMİYORUZ: yeni kullanıcı, ürünü denemeden önce bir
 * posta beklemek zorunda kalırsa çoğu geri gelmiyor. Dar bir kota, hem
 * ürünü denemeye izin veriyor hem de sahte adreslerle açılan hesapların
 * LLM maliyetini sınırlıyor.
 *
 * OTURUM GEREKTİRMİYOR: doğrulama bağlantısı çoğu zaman postanın açıldığı
 * başka bir cihazda tıklanıyor. Jetonun kendisi zaten kanıt.
 */

const IP_LIMITI = 20;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const kota = await rateLimitAsync(
      `verify-submit:${clientIp(request)}`,
      IP_LIMITI,
      60 * 60 * 1000
    );
    if (!kota.success) {
      return NextResponse.json(
        { error: "Çok fazla deneme yapıldı, daha sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(kota.retryAfter) } }
      );
    }

    const parsed = epostaDogrulamaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Geçersiz istek") },
        { status: 400 }
      );
    }

    const eposta = await jetonuTuket(
      JETON_AMACLARI.epostaDogrulama,
      parsed.data.token
    );

    if (!eposta) {
      return NextResponse.json(
        { error: "Bağlantı geçersiz ya da süresi dolmuş. Yeni bir bağlantı isteyin." },
        { status: 400 }
      );
    }

    // ZATEN DOĞRULANMIŞSA damga KORUNUYOR: `emailVerified: null` koşulu,
    // eski bir bağlantının ilk doğrulama tarihini bugüne çekmesini
    // engelliyor.
    const { count } = await prisma.user.updateMany({
      where: { email: eposta, emailVerified: null },
      data: { emailVerified: new Date() },
    });

    logger.info("E-posta doğrulandı", { email: eposta, guncellendi: count });

    return NextResponse.json({
      success: true,
      message: "E-posta adresiniz doğrulandı.",
    });
  } catch (error) {
    logger.error("E-posta doğrulanamadı", error);
    return NextResponse.json(
      { error: "Doğrulama tamamlanamadı, lütfen tekrar deneyin" },
      { status: 500 }
    );
  }
}
