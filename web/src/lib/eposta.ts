import { logger } from "@/lib/logger";

/**
 * İşlemsel e-posta gönderimi (B9).
 *
 * NEDEN SAĞLAYICI SDK'SI YOK: Resend'in REST ucu tek bir POST. Bir paket
 * eklemek, bu modülün bugün sıfır olan bağımlılığını ve build boyutunu
 * sağlayıcı seçimine bağlardı. Sağlayıcı değişirse değişecek yer bu
 * dosyadaki tek fonksiyon.
 *
 * YAPILANDIRILMAMIŞSA SESSİZCE BAŞARILI OLMUYOR. Şifre sıfırlama ve
 * e-posta doğrulama uçları, gönderim yapılandırılmamışsa 503 dönüyor.
 * Alternatif — "e-posta gönderdik" deyip hiç göndermemek — kullanıcıyı
 * var olmayan bir postayı beklemeye mahkûm ederdi; en kötü hata türü, hiç
 * görünmeyeni.
 */

/** Gönderilecek mesaj. HTML opsiyonel; düz metin ZORUNLU. */
export interface EpostaMesaji {
  kime: string;
  konu: string;
  /**
   * Düz metin gövde.
   *
   * ZORUNLU olmasının sebebi: HTML'i engelleyen istemcilerde ve spam
   * puanlamasında düz metin karşılığı olmayan bir posta ya hiç
   * okunmuyor ya da hiç ulaşmıyor.
   */
  metin: string;
  html?: string;
}

const RESEND_UCU = "https://api.resend.com/emails";

/** Gönderim tek bir dış çağrı; asılı kalan bağlantı akışı kilitlemesin. */
const ZAMAN_ASIMI_MS = 10_000;

/** Sağlayıcı anahtarı ve gönderen adresi tanımlı mı? */
export function epostaYapilandirilmisMi(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EPOSTA_GONDEREN);
}

/**
 * Bağlantıların içine konacak taban adres.
 *
 * `APP_URL` üretimde zaten tanımlı (OpenRouter'a giden HTTP-Referer için).
 * Tanımsızsa yerel geliştirme varsayılanına düşüyoruz — üretimde eksik
 * kalırsa e-postadaki bağlantı localhost'u gösterir, o yüzden .env.example
 * kontrol listesinde yer alıyor.
 */
export function uygulamaAdresi(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Mesajı gönderir.
 *
 * @returns Gönderim başarılıysa true. HİÇ FIRLATMIYOR: çağıranların
 *          çoğu (kayıt akışı gibi) e-posta gönderilemedi diye asıl işlemi
 *          geri almamalı.
 */
export async function epostaGonder(mesaj: EpostaMesaji): Promise<boolean> {
  if (!epostaYapilandirilmisMi()) {
    logger.warn("E-posta gönderimi yapılandırılmamış", undefined, {
      konu: mesaj.konu,
    });
    return false;
  }

  const kontrolcu = new AbortController();
  const zamanlayici = setTimeout(() => kontrolcu.abort(), ZAMAN_ASIMI_MS);

  try {
    const yanit = await fetch(RESEND_UCU, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EPOSTA_GONDEREN,
        to: [mesaj.kime],
        subject: mesaj.konu,
        text: mesaj.metin,
        ...(mesaj.html ? { html: mesaj.html } : {}),
      }),
      signal: kontrolcu.signal,
    });

    if (!yanit.ok) {
      // Gövde sağlayıcı hatasını taşıyor ama alıcı adresini de taşıyabilir;
      // log'a yalnızca durum kodu giriyor.
      logger.error("E-posta gönderilemedi", undefined, {
        status: yanit.status,
        konu: mesaj.konu,
      });
      return false;
    }

    logger.info("E-posta gönderildi", { konu: mesaj.konu });
    return true;
  } catch (error) {
    logger.error("E-posta gönderilemedi", error, { konu: mesaj.konu });
    return false;
  } finally {
    clearTimeout(zamanlayici);
  }
}

/* -------------------------------------------------------------------------- */
/* Şablonlar                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Şablonlar SAF ve dışa açık: içeriklerini ağ olmadan test edebiliyoruz.
 *
 * En kritik iddia bağlantının doğru olması. Yanlış bir bağlantı, akışın
 * geri kalanı kusursuz çalışsa bile kullanıcıyı kilitler.
 */

export function sifreSifirlamaMesaji(kime: string, jeton: string): EpostaMesaji {
  const bag = `${uygulamaAdresi()}/reset-password?token=${encodeURIComponent(jeton)}`;

  return {
    kime,
    konu: "Trip Planner — şifre sıfırlama",
    metin: [
      "Merhaba,",
      "",
      "Trip Planner hesabınız için şifre sıfırlama isteği aldık.",
      "Yeni şifrenizi belirlemek için bu bağlantıyı açın:",
      "",
      bag,
      "",
      "Bağlantı 1 saat geçerli ve yalnızca bir kez kullanılabilir.",
      "Bu isteği siz yapmadıysanız bu postayı yok sayabilirsiniz;",
      "şifreniz değişmez.",
    ].join("\n"),
  };
}

export function epostaDogrulamaMesaji(kime: string, jeton: string): EpostaMesaji {
  const bag = `${uygulamaAdresi()}/verify-email?token=${encodeURIComponent(jeton)}`;

  return {
    kime,
    konu: "Trip Planner — e-posta adresinizi doğrulayın",
    metin: [
      "Trip Planner'a hoş geldiniz!",
      "",
      "E-posta adresinizi doğrulamak için bu bağlantıyı açın:",
      "",
      bag,
      "",
      "Bağlantı 24 saat geçerli.",
      "",
      "Doğrulamadan da plan üretebilirsiniz, ancak saatlik plan hakkınız",
      "sınırlı kalır.",
    ].join("\n"),
  };
}
