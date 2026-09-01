/**
 * Hız sınırlayıcı.
 *
 * İKİ ARKA UÇ, TEK ARAYÜZ:
 *
 *   - **Süreç-içi (varsayılan.)** Tek instance'lı dağıtımda doğru çalışır.
 *   - **Upstash Redis (REST).** `UPSTASH_REDIS_REST_URL` ve
 *     `UPSTASH_REDIS_REST_TOKEN` tanımlıysa devreye girer; sınır tüm
 *     instance'lar arasında paylaşılır.
 *
 * NEDEN REST: Redis'in TCP protokolü Edge runtime'da ve serverless'ta
 * bağlantı havuzu sorunları çıkarıyor. REST API'si `fetch` ile çalıştığı
 * için her iki ortamda da sorunsuz ve ek bağımlılık gerektirmiyor.
 *
 * NEDEN AYNI İMZA: `rateLimit()` senkron olarak kalamazdı (ağ çağrısı
 * asenkron), bu yüzden `rateLimitAsync()` eklendi. Senkron sürüm hâlâ
 * duruyor çünkü NextAuth'un `authorize()` fonksiyonu içinde kullanılıyor ve
 * orada süreç-içi sayaç yeterli (giriş denemeleri zaten instance başına
 * anlamlı). Yeni çağrı yerleri asenkron sürümü kullanmalı.
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

// Bellek sızıntısını önlemek için süresi dolmuş kayıtları ara ara temizle.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hit] of buckets) {
    if (hit.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  success: boolean;
  /** Pencere içinde kalan istek hakkı. */
  remaining: number;
  /** Yeni hakkın açılacağı ana kadar kalan saniye. */
  retryAfter: number;
};

/**
 * Süreç-içi sliding window sayacı.
 *
 * @param key    Sayaç kimliği — kullanıcı id'si, e-posta veya IP.
 * @param limit  Pencere başına izin verilen istek sayısı.
 * @param windowMs Pencere uzunluğu (ms).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const hit = buckets.get(key);

  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, retryAfter: 0 };
  }

  hit.count += 1;

  if (hit.count > limit) {
    return {
      success: false,
      remaining: 0,
      retryAfter: Math.ceil((hit.resetAt - now) / 1000),
    };
  }

  return { success: true, remaining: limit - hit.count, retryAfter: 0 };
}

/* -------------------------------------------------------------------------- */
/* Dağıtık arka uç                                                            */
/* -------------------------------------------------------------------------- */

function upstashYapilandirmasi(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

/** Dağıtık sayaç açık mı? Log ve teşhis için dışa açık. */
export function dagitikSayacAktifMi(): boolean {
  return upstashYapilandirmasi() !== null;
}

/**
 * Upstash üzerinde tek bir pencerelik sayaç.
 *
 * `INCR` + ilk artışta `EXPIRE` deseni: atomik, tek turda iki komut.
 * Pipeline kullanılıyor ki iki ağ turu olmasın.
 */
async function upstashSay(
  yapilandirma: { url: string; token: string },
  key: string,
  windowMs: number
): Promise<{ count: number; ttlMs: number }> {
  const saniye = Math.max(1, Math.ceil(windowMs / 1000));

  const response = await fetch(`${yapilandirma.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${yapilandirma.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      // NX: yalnızca TTL yoksa kur. Böylece pencere ilk istekle başlıyor ve
      // her istekte yeniden uzamıyor (uzasaydı sürekli trafik altında sayaç
      // hiç sıfırlanmazdı).
      ["EXPIRE", key, String(saniye), "NX"],
      ["PTTL", key],
    ]),
    // Sayaç yüzünden isteği bekletmiyoruz.
    signal: AbortSignal.timeout(2000),
  });

  if (!response.ok) {
    throw new Error(`Upstash yanıtı: ${response.status}`);
  }

  const sonuc = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  const sayi = Number(sonuc[0]?.result ?? 0);
  const ttl = Number(sonuc[2]?.result ?? -1);

  return {
    count: Number.isFinite(sayi) ? sayi : 0,
    ttlMs: ttl > 0 ? ttl : windowMs,
  };
}

/**
 * Hız sınırı kontrolü — yapılandırılmışsa dağıtık, değilse süreç-içi.
 *
 * HATA DAVRANIŞI: Redis'e ulaşılamazsa süreç-içi sayaca DÜŞÜLÜR, istek
 * reddedilmez. Sınırlayıcının kendisi bir kesinti kaynağı olmamalı; en
 * kötü durumda koruma tek instance seviyesine iner, uygulama ayakta kalır.
 */
export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const yapilandirma = upstashYapilandirmasi();

  if (!yapilandirma) {
    return rateLimit(key, limit, windowMs);
  }

  try {
    const { count, ttlMs } = await upstashSay(yapilandirma, `rl:${key}`, windowMs);

    if (count > limit) {
      return {
        success: false,
        remaining: 0,
        retryAfter: Math.ceil(ttlMs / 1000),
      };
    }

    return { success: true, remaining: Math.max(0, limit - count), retryAfter: 0 };
  } catch {
    // Bilinçli olarak sessiz: sınırlayıcı hatası isteği düşürmemeli.
    // Süreç-içi sayaç devreye giriyor.
    return rateLimit(key, limit, windowMs);
  }
}

/**
 * İstemci IP'sini proxy başlıklarından çıkarır.
 * Reverse proxy arkasında değilseniz bu başlıklar taklit edilebilir —
 * mümkün olan her yerde IP yerine oturum kimliğiyle sınırlayın.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
