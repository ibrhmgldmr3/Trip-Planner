import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { rateLimitAsync } from "@/lib/rate-limit";
import {
  EPOSTA_DOGRULAMA_OMRU_MS,
  JETON_AMACLARI,
  jetonOlustur,
} from "@/lib/dogrulama-jetonu";
import { epostaDogrulamaMesaji, epostaGonder, epostaYapilandirilmisMi } from "@/lib/eposta";
import { logger } from "@/lib/logger";

/**
 * Doğrulama postasını yeniden gönderir (B9).
 *
 * OTURUM GEREKTİRİYOR — sıfırlama isteğinin aksine. Sebep: burada adres
 * gövdeden gelmiyor, oturumdan okunuyor. Adresi dışarıdan almak, bu ucu
 * herkesin herkese posta yollatabildiği bir kapıya çevirirdi.
 *
 * Hız sınırı KULLANICI başına: doğrulanmamış bir hesap, kendi adresine
 * saatte üçten fazla posta tetikleyemiyor.
 */

const SAATLIK_LIMIT = 3;

export async function POST(): Promise<NextResponse> {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    if (!epostaYapilandirilmisMi()) {
      return NextResponse.json(
        { error: "E-posta gönderimi bu sunucuda yapılandırılmamış" },
        { status: 503 }
      );
    }

    const kota = await rateLimitAsync(
      `verify-request:${auth.user.id}`,
      SAATLIK_LIMIT,
      60 * 60 * 1000
    );
    if (!kota.success) {
      return NextResponse.json(
        { error: "Çok fazla istek gönderdiniz, daha sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(kota.retryAfter) } }
      );
    }

    const kullanici = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { email: true, emailVerified: true },
    });

    if (!kullanici?.email) {
      return NextResponse.json(
        { error: "Hesabınızda doğrulanacak bir e-posta adresi yok" },
        { status: 400 }
      );
    }

    // Zaten doğrulanmışsa posta göndermiyoruz; 200 dönüyoruz çünkü
    // kullanıcının istediği durum (doğrulanmış olmak) zaten sağlanmış.
    if (kullanici.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "E-posta adresiniz zaten doğrulanmış.",
      });
    }

    const jeton = await jetonOlustur(
      JETON_AMACLARI.epostaDogrulama,
      kullanici.email,
      EPOSTA_DOGRULAMA_OMRU_MS
    );

    const gonderildi = await epostaGonder(
      epostaDogrulamaMesaji(kullanici.email, jeton)
    );

    if (!gonderildi) {
      // Sağlayıcı hatası kullanıcıya "gönderildi" diye yansımamalı.
      return NextResponse.json(
        { error: "Doğrulama postası gönderilemedi, lütfen tekrar deneyin" },
        { status: 502 }
      );
    }

    logger.info("Doğrulama postası yeniden gönderildi", { userId: auth.user.id });

    return NextResponse.json({
      success: true,
      message: "Doğrulama bağlantısı e-posta adresinize gönderildi.",
    });
  } catch (error) {
    logger.error("Doğrulama postası gönderilemedi", error);
    return NextResponse.json(
      { error: "İstek işlenemedi, lütfen tekrar deneyin" },
      { status: 500 }
    );
  }
}
