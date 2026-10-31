import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, clientIp } from "@/lib/rate-limit";
import { sifreSifirlamaIstegiSchema, ilkHataMesaji } from "@/lib/api-schemas";
import {
  JETON_AMACLARI,
  SIFRE_SIFIRLAMA_OMRU_MS,
  jetonOlustur,
} from "@/lib/dogrulama-jetonu";
import { epostaGonder, epostaYapilandirilmisMi, sifreSifirlamaMesaji } from "@/lib/eposta";
import { logger } from "@/lib/logger";

/**
 * Şifre sıfırlama isteği (B9).
 *
 * ÜÇ KURAL:
 *
 * 1. **HESAP VARLIĞI SIZDIRILMIYOR.** Adres kayıtlı olsun ya da olmasın
 *    yanıt aynı: 200 ve aynı metin. Farklı yanıt vermek, bu ucu bir
 *    "bu e-posta bu sitede kayıtlı mı" sorgulayıcısına çevirirdi.
 *
 * 2. **GÖNDERİM `after()` İÇİNDE.** Yalnızca hız için değil: kayıtlı bir
 *    adres için sağlayıcıya gidip beklemek, kayıtsız adrese göre ölçülebilir
 *    bir SÜRE FARKI yaratır ve (1)'deki gizliliği zaman kanalından sızdırır.
 *    Yanıt her iki durumda da aynı anda dönüyor.
 *
 * 3. **İKİ AYRI HIZ SINIRI.** IP başına sınır toplu denemeyi, e-posta
 *    başına sınır ise TEK BİR KİŞİYE posta yağdırmayı engelliyor. Yalnızca
 *    IP'ye bakmak, dağıtık bir istemcinin bir kullanıcının gelen kutusunu
 *    doldurmasına izin verirdi.
 */

/** Saatlik IP başına sıfırlama isteği. */
const IP_LIMITI = Number(process.env.RESET_RATE_LIMIT_PER_HOUR) || 5;

/** Saatlik ADRES başına sıfırlama isteği (posta yağmurunu engeller). */
const ADRES_LIMITI = 3;

/** Kayıtlı da olsa olmasa da dönen metin. */
const AYNI_YANIT = {
  success: true,
  message:
    "Adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. " +
    "Gelen kutunuzu ve spam klasörünü kontrol edin.",
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Yapılandırma yoksa AÇIKÇA söyleniyor. "Gönderdik" deyip hiç
    // göndermemek, kullanıcıyı olmayan bir postayı beklemeye mahkûm eder.
    if (!epostaYapilandirilmisMi()) {
      return NextResponse.json(
        { error: "Şifre sıfırlama şu an kullanılamıyor, lütfen destekle iletişime geçin" },
        { status: 503 }
      );
    }

    const ipKota = await rateLimitAsync(
      `reset-request-ip:${clientIp(request)}`,
      IP_LIMITI,
      60 * 60 * 1000
    );
    if (!ipKota.success) {
      return NextResponse.json(
        { error: "Çok fazla deneme yapıldı, daha sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(ipKota.retryAfter) } }
      );
    }

    const parsed = sifreSifirlamaIstegiSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Geçerli bir e-posta giriniz") },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    const adresKota = await rateLimitAsync(
      `reset-request-adres:${email}`,
      ADRES_LIMITI,
      60 * 60 * 1000
    );
    if (!adresKota.success) {
      // Bu 429 hesabın VAR OLDUĞUNU söylemiyor: sayaç adrese göre
      // tutuluyor, kayıtlı olup olmadığına bakılmıyor.
      return NextResponse.json(
        { error: "Çok fazla deneme yapıldı, daha sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(adresKota.retryAfter) } }
      );
    }

    const kullanici = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true },
    });

    // ŞİFRESİZ HESAP = yalnızca Google ile açılmış hesap. Sıfırlanacak bir
    // şifre yok; bağlantı gönderirsek kullanıcı şifre belirleyip sonra
    // "neden Google ile giremiyorum" durumuna düşerdi.
    const gonderilecek = Boolean(kullanici?.email && kullanici.password);

    if (gonderilecek) {
      const adres = kullanici!.email as string;

      after(async () => {
        try {
          const jeton = await jetonOlustur(
            JETON_AMACLARI.sifreSifirlama,
            adres,
            SIFRE_SIFIRLAMA_OMRU_MS
          );
          await epostaGonder(sifreSifirlamaMesaji(adres, jeton));
        } catch (error) {
          logger.error("Şifre sıfırlama postası hazırlanamadı", error);
        }
      });
    }

    logger.info("Şifre sıfırlama isteği alındı", { gonderilecek });

    return NextResponse.json(AYNI_YANIT);
  } catch (error) {
    logger.error("Şifre sıfırlama isteği işlenemedi", error);
    return NextResponse.json(
      { error: "İstek işlenemedi, lütfen tekrar deneyin" },
      { status: 500 }
    );
  }
}
