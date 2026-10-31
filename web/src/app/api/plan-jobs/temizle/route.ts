import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { tumAsilKalanlariTemizle } from "@/lib/plan-job";
import { logger } from "@/lib/logger";

/**
 * Asılı kalmış plan üretim işlerini temizler (B10).
 *
 * NEDEN VAR: `plan-job.ts` iş kuyruğunu `after()` üzerine kuruyor ve bunun
 * bilinen bir sınırı var — sunucu üretim ortasında yeniden başlarsa iş
 * RUNNING'de kalıyor. Temizlik bugün YALNIZCA kullanıcı durum sorgusu
 * yaptığında çalışıyor (`GET /api/plan-jobs/[id]`).
 *
 * O yeterli değil: kullanıcı sekmeyi kapatır ve bir daha sormazsa iş
 * sonsuza kadar RUNNING kalıyor. Sonucu yalnızca kozmetik de değil —
 * `devamEdenIs` o işi "devam ediyor" saydığı için kullanıcı 10 dakika
 * boyunca YENİ PLAN ÜRETEMİYOR. Yani asılı bir iş, kullanıcıyı kilitliyor.
 *
 * Bu uç zamanlanmış bir görevden (Vercel Cron, GitHub Actions, systemd
 * timer) dakikada bir çağrılmak üzere yazıldı.
 *
 * KİMLİK: oturum DEĞİL, paylaşılan sır. Çağıran bir insan değil, bir
 * zamanlayıcı; ayrıca temizlik kullanıcı kapsamsız çalışıyor, yani bir
 * kullanıcının oturumuyla yetkilendirmek anlamsız olurdu.
 *
 * `CRON_SECRET` tanımsızsa uç KAPALI (503). Sırsız çalıştırmak, herkesin
 * çağırabildiği bir yazma ucu demek olurdu; sessizce açık bırakmaktansa
 * kapalı olduğunu söylemek doğru.
 */

/** Sabit zamanlı karşılaştırma; sır uzunluğu bile sızmasın. */
function sirEsitMi(gelen: string, beklenen: string): boolean {
  const a = Buffer.from(gelen);
  const b = Buffer.from(beklenen);

  // `timingSafeEqual` eşit uzunluk istiyor. Uzunluk farkını burada
  // döndürmek bir zamanlama kanalı DEĞİL: uzunluk zaten `a.length`
  // üzerinden gözlemlenebilir bir şey değil, istek gövdesinde saldırganın
  // kendi verdiği değer.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** `Authorization: Bearer <sır>` başlığından sırrı çıkarır. */
function sirriOku(request: NextRequest): string | null {
  const baslik = request.headers.get("authorization");
  if (!baslik) return null;

  const [tur, deger] = baslik.split(" ");
  if (tur?.toLowerCase() !== "bearer" || !deger) return null;

  return deger.trim();
}

export async function POST(request: NextRequest) {
  try {
    const beklenen = env.CRON_SECRET?.trim();

    if (!beklenen) {
      logger.warn("Temizlik ucu çağrıldı ama CRON_SECRET tanımsız");
      return NextResponse.json(
        { error: "Zamanlanmış temizlik bu sunucuda yapılandırılmamış" },
        { status: 503 }
      );
    }

    const gelen = sirriOku(request);

    if (!gelen || !sirEsitMi(gelen, beklenen)) {
      // Hangi kısmın yanlış olduğunu SÖYLEMİYORUZ (başlık yok mu, sır mı
      // yanlış): ayrım saldırgana ilerleme bilgisi verir.
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const temizlenen = await tumAsilKalanlariTemizle();

    return NextResponse.json({ success: true, temizlenen });
  } catch (error) {
    logger.error("Asılı işler temizlenemedi", error);
    return NextResponse.json(
      { error: "Temizlik çalıştırılamadı" },
      { status: 500 }
    );
  }
}
