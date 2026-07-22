/**
 * Uygulama genelinde tek log girişi — bağımlılıksız ve izomorfik.
 *
 * Neden hazır bir kütüphane (pino/winston) değil: ikisi de Node'a özgü
 * API'lere (stream, worker_threads) dayanıyor. Bu modülün hem route
 * handler'larda, hem `"use client"` bileşenlerinde, hem de Edge
 * middleware'de import edilebilmesi gerekiyor; bu yüzden altında yalnızca
 * `console.*` var. Bundle'a eklediği ağırlık ~1.5 KB.
 *
 * Kullanım:
 *   logger.debug("Ayrıştırma başladı", { uzunluk: markdown.length });
 *   logger.info("Plan kaydedildi", { planId });
 *   logger.warn("Markdown dönüştürülemedi", markdownError);
 *   logger.error("Plan silinemedi", error, { planId });
 *
 * PII kuralı: context objesindeki `email`, `token`, `user_id` gibi alanlar
 * `redact()` tarafından otomatik maskelenir. Buna rağmen log'a bilinçli
 * olarak ham e-posta, oturum objesi, prompt ya da sağlayıcı yanıtı
 * koymayın — maskeleme son savunma hattıdır, ilk değil.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function isLogLevel(value: string | undefined): value is LogLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}

// Next bu iki değeri build sırasında literal'e çevirir; tarayıcıda
// `process` nesnesi aranmaz. Bu yüzden ikisi de STATİK okunmalı.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LEVEL_OVERRIDE = process.env.NEXT_PUBLIC_LOG_LEVEL;

/**
 * Üretimde `debug` kapalı. Geçici olarak açmak için `.env.local`'a
 * `NEXT_PUBLIC_LOG_LEVEL=debug` ekleyip yeniden build alın.
 */
const MIN_LEVEL: LogLevel = isLogLevel(LEVEL_OVERRIDE)
  ? LEVEL_OVERRIDE
  : IS_PRODUCTION
    ? "info"
    : "debug";

const IS_SERVER = typeof window === "undefined";

/* -------------------------------------------------------------------------- */
/* PII maskeleme                                                              */
/* -------------------------------------------------------------------------- */

/** Değeri tamamen gizlenecek alan adları. */
const SECRET_KEY =
  /^(password|parola|token|accessToken|refreshToken|idToken|secret|apiKey|api_key|authorization|cookie|session)$/i;

/** E-posta olarak maskelenecek alan adları (`email`, `userEmail`, `user_email`, `mail`). */
const EMAIL_KEY = /(^|_)e?mail$|email$/i;

/** Kullanıcı kimliği olarak maskelenecek alan adları. `planId` bilinçli olarak listede yok. */
const USER_ID_KEY = /^(user_?id|userId|ownerId|accountId|sub)$/i;

/**
 * Uzun serbest metin: kırpılır (prompt, model yanıtı, ham markdown).
 *
 * `detay` de burada: OpenRouter istemcisi hata gövdesinin ilk 1000 karakterini
 * bu alana koyuyor ve o gövde prompt'u yankılayabiliyor. Kırpma teşhis için
 * yeterli bir kesiti bırakırken sağlayıcı yanıtının log'a düz akmasını keser.
 */
const BULK_TEXT_KEY =
  /^(prompt|content|message|markdown|html|raw_markdown|raw_html|body|response|responseText|plan|gun_plani|butce_tahmini|detay)$/i;

const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_DEPTH = 3;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING = 512;
const MAX_BULK_STRING = 160;

/** `ibrahim@example.com` → `i***@example.com` */
export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return "***";
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

/**
 * Kimlik değerini korelasyon için kullanılabilir, tekil kullanıcıya
 * geri götürülemez hâle indirger: `cmf1a2b3c4d5e6f7` → `cmf1***f7`
 */
export function maskId(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

/** Uzun metni kırpar; ne kadar atıldığını da yazar. */
export function truncate(value: string, max = MAX_BULK_STRING): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… (+${value.length - max} karakter)`;
}

/**
 * Bir Error'u log'lanabilir düz objeye çevirir.
 *
 * DİKKAT: `message` alanı sağlayıcıdan/Prisma'dan gelen PII taşıyabilir
 * (ör. unique constraint hatası e-postayı mesaja koyabiliyor), bu yüzden
 * kırpılıyor ve e-posta kalıbı maskeleniyor.
 */
function serializeError(cause: unknown): LogContext {
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: truncate(cause.message.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, maskEmail), 300),
      stack: cause.stack ? truncate(cause.stack, 2000) : undefined,
    };
  }
  return { value: truncate(String(cause), 300) };
}

/**
 * Context objesini PII açısından temizler.
 *
 * Derinlik ve eleman sayısı sınırlı; hem devasa Prisma sonuçlarının log'u
 * şişirmesini hem de döngüsel referanslarda sonsuz özyinelemeyi engeller.
 */
export function redact(value: unknown, key = "", depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (SECRET_KEY.test(key)) return "[gizli]";
    if (EMAIL_KEY.test(key)) return maskEmail(value);
    if (USER_ID_KEY.test(key)) return maskId(value);
    if (BULK_TEXT_KEY.test(key)) return truncate(value);
    // Alan adı ipucu vermese bile değerin kendisi e-posta olabilir.
    if (EMAIL_VALUE.test(value)) return maskEmail(value);
    return truncate(value, MAX_STRING);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return SECRET_KEY.test(key) ? "[gizli]" : value;
  }

  // JSON.stringify bigint'te patlar.
  if (typeof value === "bigint") return value.toString();

  if (value instanceof Error) return serializeError(value);
  if (value instanceof Date) return value.toISOString();

  if (SECRET_KEY.test(key)) return "[gizli]";

  if (depth >= MAX_DEPTH) return "[derinlik sınırı]";

  if (Array.isArray(value)) {
    const items: unknown[] = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => redact(item, key, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`… (+${value.length - MAX_ARRAY_ITEMS} kayıt)`);
    }
    return items;
  }

  if (typeof value === "object") {
    const out: LogContext = {};
    for (const [childKey, childValue] of Object.entries(value as LogContext)) {
      out[childKey] = redact(childValue, childKey, depth + 1);
    }
    return out;
  }

  // function, symbol
  return "[serileştirilemedi]";
}

/* -------------------------------------------------------------------------- */
/* Yazma                                                                      */
/* -------------------------------------------------------------------------- */

const CONSOLE: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export function isLevelEnabled(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[MIN_LEVEL];
}

function emit(level: LogLevel, message: string, cause?: unknown, context?: LogContext): void {
  if (!isLevelEnabled(level)) return;

  const detail: LogContext = context ? (redact(context) as LogContext) : {};
  if (cause !== undefined) detail.err = serializeError(cause);

  const write = CONSOLE[level];
  const time = new Date().toISOString();
  const scope = IS_SERVER ? "server" : "client";

  if (IS_PRODUCTION) {
    // Üretimde tek satır JSON: log toplayıcılar (Vercel, Docker, journald)
    // satır bazlı ayrıştırıyor.
    try {
      write(JSON.stringify({ time, level, scope, msg: message, ...detail }));
    } catch {
      // Döngüsel referans vb. — mesajı yine de kaybetme.
      write(JSON.stringify({ time, level, scope, msg: message, detail: "[serileştirilemedi]" }));
    }
    return;
  }

  // Geliştirmede okunabilir biçim; detay objesi devtools'ta açılabilir kalsın.
  const prefix = `${time} [${level}/${scope}] ${message}`;
  if (Object.keys(detail).length > 0) {
    write(prefix, detail);
  } else {
    write(prefix);
  }
}

/* -------------------------------------------------------------------------- */
/* Genel arayüz                                                               */
/* -------------------------------------------------------------------------- */

export type Logger = {
  /** Yalnızca geliştirmede görünür; ayrıştırma/akış izleri buraya. */
  debug(message: string, context?: LogContext): void;
  /** Kalıcı durum değişiklikleri (kayıt oluştu, statü değişti). */
  info(message: string, context?: LogContext): void;
  /** Beklenen ama istenmeyen durum: fallback'e düşüldü, upstream 4xx döndü. */
  warn(message: string, cause?: unknown, context?: LogContext): void;
  /** İşlem tamamlanamadı. */
  error(message: string, cause?: unknown, context?: LogContext): void;
  /** Sabit context taşıyan alt logger üretir: `logger.child({ route: "/api/trip" })` */
  child(context: LogContext): Logger;
  /** Pahalı context hesaplamasını gereksiz yere yapmamak için. */
  isLevelEnabled(level: LogLevel): boolean;
};

function createLogger(base: LogContext = {}): Logger {
  return {
    debug: (message, context) => emit("debug", message, undefined, { ...base, ...context }),
    info: (message, context) => emit("info", message, undefined, { ...base, ...context }),
    warn: (message, cause, context) => emit("warn", message, cause, { ...base, ...context }),
    error: (message, cause, context) => emit("error", message, cause, { ...base, ...context }),
    child: (context) => createLogger({ ...base, ...context }),
    isLevelEnabled,
  };
}

export const logger = createLogger();
