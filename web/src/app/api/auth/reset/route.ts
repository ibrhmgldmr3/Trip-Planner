import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, clientIp } from "@/lib/rate-limit";
import { sifreSifirlamaSchema, ilkHataMesaji } from "@/lib/api-schemas";
import { JETON_AMACLARI, jetonuTuket } from "@/lib/dogrulama-jetonu";
import { logger } from "@/lib/logger";

/**
 * Şifre sıfırlamayı tamamlar (B9).
 *
 * JETON TÜKETİMİ ŞİFRE YAZIMINDAN ÖNCE. Sıra tersine olsaydı, yazma
 * başarılı olup silme başarısız olduğunda jeton geçerli kalır ve aynı
 * bağlantı ikinci kez kullanılabilirdi. Bu sırayla en kötü durum,
 * kullanıcının bağlantıyı yeniden istemesi.
 *
 * BİLİNEN SINIR — AÇIK OTURUMLAR SONLANDIRILMIYOR. NextAuth burada JWT
 * stratejisiyle çalışıyor; oturum sunucuda bir satır değil, imzalı bir
 * çerez. Şifre değişse de daha önce verilmiş bir JWT süresi dolana kadar
 * geçerli kalıyor. Yani oturumu çalınmış bir kullanıcı, şifresini
 * değiştirerek saldırganı ANINDA atamıyor. Kapatmanın yolu her istekte
 * veritabanına bakmak (JWT stratejisinin varlık sebebini ortadan
 * kaldırır) ya da şemaya bir "şifre değişim damgası" eklemek; ikisi de bu
 * maddenin kapsamı dışında ve belgeye borç olarak yazıldı.
 */

/** Saatlik IP başına sıfırlama denemesi; jeton tahmini pahalı olsun. */
const IP_LIMITI = Number(process.env.RESET_RATE_LIMIT_PER_HOUR) || 5;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const kota = await rateLimitAsync(
      `reset-submit:${clientIp(request)}`,
      IP_LIMITI,
      60 * 60 * 1000
    );
    if (!kota.success) {
      return NextResponse.json(
        { error: "Çok fazla deneme yapıldı, daha sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(kota.retryAfter) } }
      );
    }

    const parsed = sifreSifirlamaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Geçersiz istek") },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    const eposta = await jetonuTuket(JETON_AMACLARI.sifreSifirlama, token);

    // "Geçersiz", "süresi dolmuş" ve "yanlış akış" AYIRT EDİLMİYOR: hangi
    // jetonun var olduğunu doğrulamak deneme yanılmayı ödüllendirirdi.
    if (!eposta) {
      return NextResponse.json(
        { error: "Bağlantı geçersiz ya da süresi dolmuş. Lütfen yeniden isteyin." },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 12);

    // `updateMany`: jeton geçerliyken kullanıcı silinmiş olabilir; `update`
    // o durumda P2025 fırlatıp 500'e düşerdi.
    const { count } = await prisma.user.updateMany({
      where: { email: eposta },
      data: { password: hash },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Bağlantı geçersiz ya da süresi dolmuş. Lütfen yeniden isteyin." },
        { status: 400 }
      );
    }

    logger.info("Şifre sıfırlandı", { email: eposta });

    return NextResponse.json({
      success: true,
      message: "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.",
    });
  } catch (error) {
    logger.error("Şifre sıfırlanamadı", error);
    return NextResponse.json(
      { error: "Şifre güncellenemedi, lütfen tekrar deneyin" },
      { status: 500 }
    );
  }
}
