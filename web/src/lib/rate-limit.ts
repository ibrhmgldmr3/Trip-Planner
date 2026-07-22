/**
 * Basit, süreç-içi (in-memory) sliding window rate limiter.
 *
 * UYARI: Sayaç process belleğinde tutulur. Tek instance'lı bir dağıtımda
 * (tek Node sunucusu, tek container) doğru çalışır; birden fazla instance
 * veya serverless (her invocation ayrı process) altında sınır instance
 * başına uygulanır. Yatay ölçeklemeye geçildiğinde burayı Redis tabanlı
 * bir limiter ile (ör. @upstash/ratelimit) değiştirin — çağıran taraf
 * imzayı korurken sadece bu dosya değişir.
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
