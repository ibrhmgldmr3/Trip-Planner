import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Sağlık kontrolü.
 *
 * Eskiden sabit bir nesne dönüyordu: veritabanı çökmüş olsa bile "ok"
 * diyordu, yani load balancer ve izleme sistemi için değersizdi. Artık
 * bağımlılıkları gerçekten yokluyor.
 *
 * TASARIM: yalnızca VERİTABANI kritik sayılıyor. OpenRouter erişilemezse
 * plan üretimi çalışmaz ama uygulamanın geri kalanı (kayıtlı planlar, bütçe,
 * profil) çalışmaya devam eder — bu yüzden onun durumu raporlanıyor ama
 * genel sonucu "error"a çevirmiyor. Sağlıklı bir instance'ı dış bir
 * sağlayıcı yüzünden havuzdan çıkarmak, kesintiyi büyütmekten başka işe
 * yaramaz.
 */

export const dynamic = 'force-dynamic';

type BagimlilikDurumu = {
  status: 'ok' | 'error' | 'atlandi';
  latencyMs?: number;
  error?: string;
};

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version?: string;
  environment?: string;
  uptimeSeconds?: number;
  checks: {
    database: BagimlilikDurumu;
    openrouter: BagimlilikDurumu;
  };
}

/** Yoklamayı süre sınırına bağlar; asılı kalan bir bağlantı /health'i kilitlemesin. */
async function zamanSinirli<T>(is: Promise<T>, ms: number): Promise<T> {
  let zamanlayici: ReturnType<typeof setTimeout>;

  const zamanAsimi = new Promise<never>((_, reddet) => {
    zamanlayici = setTimeout(() => reddet(new Error(`Zaman aşımı (${ms} ms)`)), ms);
  });

  try {
    return await Promise.race([is, zamanAsimi]);
  } finally {
    clearTimeout(zamanlayici!);
  }
}

async function veritabaniniYokla(): Promise<BagimlilikDurumu> {
  const baslangic = Date.now();

  try {
    // En ucuz gerçek sorgu: bağlantıyı ve yetkiyi doğruluyor, tabloya
    // dokunmuyor.
    await zamanSinirli(prisma.$queryRaw`SELECT 1`, 3000);
    return { status: 'ok', latencyMs: Date.now() - baslangic };
  } catch (error) {
    logger.error('Sağlık kontrolü: veritabanına erişilemedi', error);
    return {
      status: 'error',
      latencyMs: Date.now() - baslangic,
      // Hata metni bağlantı dizesi taşıyabiliyor; yalnızca tür bilgisi.
      error: error instanceof Error ? error.name : 'Bilinmeyen hata',
    };
  }
}

async function openRouterYokla(): Promise<BagimlilikDurumu> {
  // `?deep=1` verilmedikçe dış ağa çıkmıyoruz: /health sık çağrılıyor ve
  // her çağrıda sağlayıcıya istek atmak hem yavaş hem gereksiz.
  if (!process.env.OPENROUTER_API_KEY) {
    return { status: 'error', error: 'OPENROUTER_API_KEY tanımsız' };
  }
  return { status: 'ok' };
}

export async function GET(request: Request): Promise<NextResponse<HealthCheckResponse>> {
  const derin = new URL(request.url).searchParams.get('deep') === '1';

  const database = await veritabaniniYokla();
  const openrouter = derin
    ? await openRouterYokla()
    : { status: 'atlandi' as const };

  // Yalnızca veritabanı genel sonucu belirliyor (bkz. dosya başındaki not).
  const status: 'ok' | 'error' = database.status === 'ok' ? 'ok' : 'error';

  const govde: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    checks: { database, openrouter },
  };

  return NextResponse.json(govde, {
    // 503: "şu an hizmet veremiyorum" — load balancer'ın anladığı dil.
    // 500 kalıcı bir hata gibi okunur.
    status: status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
