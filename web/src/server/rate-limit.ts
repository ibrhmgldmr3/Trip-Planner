// Bellek içi kayan pencere hız sınırlayıcı.
// Tek sunucu örneğinde yeterlidir; birden çok örnek ya da sunucusuz ortamda
// sayaçlar paylaşılmaz. O durumda bu arayüzün arkasına Redis gibi ortak bir
// depo konmalıdır (çağıran taraf değişmez).

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  /** Sınır aşıldıysa yeniden denemek için beklenecek saniye. */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((time) => now - time < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const retryAfter = Math.ceil((windowMs - (now - bucket.hits[0])) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Bellek sınırsız büyümesin: en eski anahtarları at.
  if (buckets.size > MAX_KEYS) {
    const overflow = buckets.size - MAX_KEYS;
    let removed = 0;
    for (const oldKey of buckets.keys()) {
      buckets.delete(oldKey);
      if (++removed >= overflow) break;
    }
  }

  return { ok: true, retryAfter: 0 };
}

/**
 * İstemci IP'si: x-forwarded-for'un SON değeri. İlk değerleri istemci kendisi yazabilir;
 * sonuncuyu uygulamanın önündeki vekil (nginx, Vercel…) ekler. Uygulamanın önünde art arda
 * iki vekil varsa (ör. Cloudflare + nginx) son değer dıştaki vekilin adresi olur ve herkes
 * aynı sayaca düşer; o kurulumda bu işlev vekil sayısına göre uyarlanmalıdır.
 */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const read = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const forwarded = read("x-forwarded-for")?.split(",").pop()?.trim();
  return forwarded || read("x-real-ip")?.trim() || "bilinmiyor";
}

/** Testler için sayaçları sıfırlar. */
export function resetRateLimits() {
  buckets.clear();
}
