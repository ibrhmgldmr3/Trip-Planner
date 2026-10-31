import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { modelleriYokla } from '@/lib/openrouter';
import { dagitikSayacAktifMi } from '@/lib/rate-limit';
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
  status: 'ok' | 'error' | 'uyari' | 'atlandi';
  latencyMs?: number;
  error?: string;
};

/**
 * OpenRouter yoklaması, bağımlılık durumuna ek olarak MODEL bilgisi taşıyor.
 *
 * NEDEN AYRI ALANLAR: bu servisin "ayakta olması" yetmiyor. Üç kez yaşanan
 * hata OpenRouter'ın çökmesi değildi — yapılandırılmış modelin katalogdan
 * SESSİZCE kalkmasıydı. İzleme sisteminin göreceği alan `eksikModeller`.
 */
type OpenRouterDurumu = BagimlilikDurumu & {
  /** Yapılandırılmış modeller ve katalogdaki karşılıkları. */
  modeller?: Array<{ model: string; bulundu: boolean; ucretsiz: boolean }>;
  /** Katalogda bulunamayan modeller. Boş olmayan bir liste = üretim kırık. */
  eksikModeller?: string[];
};

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version?: string;
  environment?: string;
  uptimeSeconds?: number;
  checks: {
    database: BagimlilikDurumu;
    openrouter: OpenRouterDurumu;
    /**
     * Hız sınırlayıcının dağıtık olup olmadığı. Çok instance'lı bir
     * dağıtımda `dagitik: false` demek, sınırın instance başına
     * uygulandığı ve pratikte n katına çıktığı anlamına geliyor.
     */
    rateLimit: {
      dagitik: boolean;
      /**
       * Üretimde dağıtık sayaç yoksa uyarı metni.
       *
       * Yalnızca `dagitik: false` bayrağını yayımlamak yetmiyordu:
       * izleme sistemini kuran kişi bu alanın ne anlama geldiğini bilmek
       * zorunda kalıyordu. Uyarı, sonucu okunur kılıyor.
       */
      uyari?: string;
    };
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

/**
 * OpenRouter yoklaması.
 *
 * Eskiden bu fonksiyon yalnızca `OPENROUTER_API_KEY`in TANIMLI OLDUĞUNU
 * kontrol ediyordu — yani `?deep=1` ile sığ kontrol arasında hiçbir fark
 * yoktu ve asıl hata modunu (modelin katalogdan kalkması) hiç görmüyordu.
 * Artık derin yoklama kataloğu gerçekten okuyor.
 *
 * ÜÇ AYRI DURUM:
 *   error  → anahtar yok, ya da yapılandırılmış modeller katalogda yok.
 *            İkincisi "plan üretimi şu an kırık" demek.
 *   uyari  → katalog okunamadı (sağlayıcı 5xx, zaman aşımı) ya da üretimde
 *            ücretsiz model kullanılıyor. Uygulama çalışıyor, ama bakılmalı.
 *   ok     → modeller yerinde.
 */
async function openRouterYokla(derin: boolean): Promise<OpenRouterDurumu> {
  if (!process.env.OPENROUTER_API_KEY) {
    return { status: 'error', error: 'OPENROUTER_API_KEY tanımsız' };
  }

  // `?deep=1` verilmedikçe dış ağa çıkmıyoruz: /health sık çağrılıyor ve
  // her çağrıda sağlayıcıya istek atmak hem yavaş hem gereksiz.
  if (!derin) return { status: 'ok' };

  const baslangic = Date.now();
  const yoklama = await modelleriYokla();
  const latencyMs = Date.now() - baslangic;

  if (!yoklama.ok) {
    // Katalog okunamadı. Modellerin durumu BİLİNMİYOR; "error" demek
    // geçici bir sağlayıcı kesintisini kalıcı bir arıza gibi gösterirdi.
    logger.warn('Sağlık kontrolü: OpenRouter kataloğu okunamadı', undefined, {
      status: yoklama.status,
      detay: yoklama.detay,
    });
    return {
      status: 'uyari',
      latencyMs,
      error: `Katalog okunamadı (HTTP ${yoklama.status})`,
      modeller: yoklama.modeller,
    };
  }

  if (yoklama.eksikler.length > 0) {
    logger.error('Sağlık kontrolü: yapılandırılmış model katalogda yok', undefined, {
      eksikler: yoklama.eksikler,
    });
    return {
      status: 'error',
      latencyMs,
      error: `Katalogda olmayan model: ${yoklama.eksikler.join(', ')}`,
      modeller: yoklama.modeller,
      eksikModeller: yoklama.eksikler,
    };
  }

  // Modeller yerinde ama ücretsiz: bugün çalışıyor, yarınının garantisi yok.
  const ucretsizler = yoklama.modeller.filter((m) => m.ucretsiz).map((m) => m.model);
  if (ucretsizler.length > 0 && process.env.NODE_ENV === 'production') {
    return {
      status: 'uyari',
      latencyMs,
      error: `Üretimde ücretsiz model: ${ucretsizler.join(', ')}`,
      modeller: yoklama.modeller,
      eksikModeller: [],
    };
  }

  return { status: 'ok', latencyMs, modeller: yoklama.modeller, eksikModeller: [] };
}

/**
 * Hız sınırlayıcının dağıtık olup olmadığını raporlar.
 *
 * NEDEN ÖNEMLİ: `UPSTASH_*` tanımlı değilse sayaç SÜREÇ İÇİ tutuluyor.
 * Tek instance'lı bir dağıtımda bu doğru çalışıyor, ama yatay ölçeklemede
 * her instance kendi sayacını tutuyor ve sınır pratikte instance sayısı
 * kadar katlanıyor — saatte 5 plan hakkı, 4 instance'ta 20 oluyor.
 *
 * Bu sessiz bir bozulma: hiçbir hata üretmiyor, yalnızca koruma
 * gevşiyor. Sağlık ucunda görünür olması, üretime çıkmadan fark
 * edilmesinin tek yolu.
 */
function hizSinirlayiciDurumu(): HealthCheckResponse['checks']['rateLimit'] {
  const dagitik = dagitikSayacAktifMi();

  if (dagitik || process.env.NODE_ENV !== 'production') {
    return { dagitik };
  }

  return {
    dagitik: false,
    uyari:
      'Üretimde süreç-içi hız sınırlayıcı kullanılıyor. Birden çok instance ' +
      'çalışıyorsa sınır her instance için ayrı uygulanır; UPSTASH_REDIS_REST_URL ' +
      've UPSTASH_REDIS_REST_TOKEN tanımlayın.',
  };
}

export async function GET(request: Request): Promise<NextResponse<HealthCheckResponse>> {
  const derin = new URL(request.url).searchParams.get('deep') === '1';

  // Veritabanı ve OpenRouter birbirinden bağımsız; sırayla beklemek
  // `?deep=1` yanıtını gereksiz yavaşlatırdı.
  const [database, openrouter] = await Promise.all([
    veritabaniniYokla(),
    openRouterYokla(derin),
  ]);

  // Yalnızca veritabanı genel sonucu belirliyor (bkz. dosya başındaki not).
  // OpenRouter'ın `error` olması bile 503'e ÇEVİRMİYOR: plan üretimi durur
  // ama kayıtlı planlar, bütçe ve profil çalışmaya devam eder. İzleme
  // sistemi `checks.openrouter.eksikModeller` alanına ayrıca alarm kursun.
  const status: 'ok' | 'error' = database.status === 'ok' ? 'ok' : 'error';

  const govde: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database,
      openrouter,
      rateLimit: hizSinirlayiciDurumu(),
    },
  };

  return NextResponse.json(govde, {
    // 503: "şu an hizmet veremiyorum" — load balancer'ın anladığı dil.
    // 500 kalıcı bir hata gibi okunur.
    status: status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
