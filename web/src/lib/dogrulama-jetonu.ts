import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Tek kullanımlık doğrulama jetonları (B9).
 *
 * Şifre sıfırlama ve e-posta doğrulama akışlarının ortak altyapısı.
 * `VerificationToken` tablosu şemada NextAuth adapter'ı için zaten
 * vardı ve hiç kullanılmıyordu; iki akış da onun üzerine kuruldu.
 *
 * ÜÇ TASARIM KARARI:
 *
 * 1. **Veritabanında HAM JETON DURMUYOR, SHA-256 özeti duruyor.** Jeton
 *    bir parola kadar güçlü: elinde olan, hesabın şifresini değiştirebilir.
 *    Yedek dosyası, log ya da SQL sızıntısı hâlinde ham jetonlar doğrudan
 *    kullanılabilir olurdu. Özet tek yönlü; sızan satırla hesap ele
 *    geçirilemiyor. (Parolalardan farklı olarak bcrypt gerekmiyor: jeton
 *    256 bit rastgele, sözlük saldırısına konu değil.)
 *
 * 2. **Amaç `identifier` içinde ve DOĞRULANIYOR.** Aksi halde e-posta
 *    doğrulama jetonu şifre sıfırlamada kullanılabilirdi: kullanıcının
 *    gelen kutusuna erişen değil, yalnızca ELİNDE ESKİ BİR DOĞRULAMA
 *    BAĞLANTISI OLAN biri bile şifreyi değiştirebilirdi.
 *
 * 3. **Tüketim TEK SEFERLİK ve atomik.** `deleteMany` sonucundaki satır
 *    sayısı kontrol ediliyor: iki eşzamanlı istek aynı jetonu kullanmaya
 *    kalkarsa yalnızca biri 1 satır siler, diğeri 0 görür ve reddedilir.
 *    "Önce oku, sonra sil" deseni bu yarışta iki isteği de geçirirdi.
 */

/** Jeton amaçları; `identifier` alanının önekini belirliyor. */
export const JETON_AMACLARI = {
  sifreSifirlama: "sifre-sifirlama",
  epostaDogrulama: "eposta-dogrulama",
} as const;

export type JetonAmaci = (typeof JETON_AMACLARI)[keyof typeof JETON_AMACLARI];

/** Şifre sıfırlama ömrü: kısa, çünkü hesabı ele geçirmeye yetiyor. */
export const SIFRE_SIFIRLAMA_OMRU_MS = 60 * 60 * 1000;

/**
 * E-posta doğrulama ömrü: uzun, çünkü riski düşük ve kullanıcı postayı
 * ertesi gün açabiliyor. Kısa tutmak, doğrulamayı zorlaştırmaktan başka
 * bir şeye yaramazdı.
 */
export const EPOSTA_DOGRULAMA_OMRU_MS = 24 * 60 * 60 * 1000;

/** `identifier` sütununa yazılan değer. */
function kimlik(amac: JetonAmaci, eposta: string): string {
  return `${amac}:${eposta.trim().toLocaleLowerCase("tr")}`;
}

/** Ham jetonun veritabanında saklanan karşılığı. */
export function jetonOzeti(ham: string): string {
  return createHash("sha256").update(ham).digest("hex");
}

/**
 * Yeni bir jeton üretip kaydeder ve HAM hâlini döndürür.
 *
 * Ham jeton yalnızca burada ve gönderilen e-postada var; bir daha
 * okunamıyor. Aynı amaç için bekleyen ESKİ JETONLAR SİLİNİYOR: kullanıcı
 * "bağlantı gelmedi" deyip tekrar istediğinde ortalıkta iki geçerli
 * bağlantı kalması, ilk postaya erişen birinin penceresini uzatırdı.
 */
export async function jetonOlustur(
  amac: JetonAmaci,
  eposta: string,
  omurMs: number
): Promise<string> {
  const ham = randomBytes(32).toString("base64url");
  const identifier = kimlik(amac, eposta);

  await prisma.verificationToken.deleteMany({ where: { identifier } });

  await prisma.verificationToken.create({
    data: {
      identifier,
      token: jetonOzeti(ham),
      expires: new Date(Date.now() + omurMs),
    },
  });

  return ham;
}

/**
 * Jetonu doğrular, TÜKETİR ve ait olduğu e-postayı döndürür.
 *
 * @returns Geçerliyse e-posta adresi; geçersiz/süresi dolmuş/yanlış
 *          amaçlı ise null. ÇAĞIRAN BU ÜÇÜNÜ AYIRT ETMEMELİ — hangi
 *          jetonun var olduğunu doğrulamak, deneme yanılmaya yol açar.
 */
export async function jetonuTuket(
  amac: JetonAmaci,
  ham: string
): Promise<string | null> {
  if (!ham) return null;

  const kayit = await prisma.verificationToken.findUnique({
    where: { token: jetonOzeti(ham) },
  });

  if (!kayit) return null;

  // AMAÇ KONTROLÜ: özeti bulunan bir jeton, doğru akışa ait olmayabilir.
  const onek = `${amac}:`;
  if (!kayit.identifier.startsWith(onek)) {
    logger.warn("Jeton yanlış akışta kullanılmaya çalışıldı", undefined, { amac });
    return null;
  }

  // Süresi dolmuş jeton yine de siliniyor: tablo kendi kendini toplasın.
  if (kayit.expires.getTime() <= Date.now()) {
    await prisma.verificationToken.deleteMany({ where: { token: kayit.token } });
    return null;
  }

  // Tek kullanım: silinen satır sayısı 0 ise başka bir istek bizden önce
  // tüketmiş demektir.
  const { count } = await prisma.verificationToken.deleteMany({
    where: { token: kayit.token },
  });

  if (count === 0) return null;

  return kayit.identifier.slice(onek.length);
}

