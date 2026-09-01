import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url().optional(),
    OPENROUTER_API_KEY: z.string().min(1),
    // Model kimliği env'den okunuyor; boş bırakılırsa openrouter.ts'teki
    // varsayılanlar kullanılır (katalogdan model kalkarsa kod değiştirmeden
    // yeni modele geçilebilsin diye).
    OPENROUTER_MODEL: z.string().optional(),
    OPENROUTER_MODEL_FALLBACK: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    APP_URL: z.string().url().optional(),
    // Dağıtık hız sınırlayıcı (Upstash Redis REST). İkisi birden tanımlıysa
    // sınır tüm instance'lar arasında paylaşılır; yoksa süreç-içi sayaca
    // düşülür (bkz. src/lib/rate-limit.ts).
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    // Agentic (araç çağıran) plan üretimi — bkz. src/lib/together.ts.
    // Tanımsızsa bu yol tamamen devre dışı kalır, mevcut OpenRouter zinciri
    // değişmeden çalışmaya devam eder.
    TOGETHER_API_KEY: z.string().min(1).optional(),
    TOGETHER_MODEL: z.string().optional(),
    // Web arama aracı (Tavily) — bkz. src/lib/web-search.ts. Tanımsızsa
    // agentic yol modele hiçbir araç sunmadan (yalnızca Together üzerinden
    // tek turlu yapılandırılmış üretim olarak) çalışır.
    TAVILY_API_KEY: z.string().min(1).optional(),
    /**
     * Sunucu taraflı Geocoding için AYRI bir anahtar — aşağıdaki
     * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ile aynısı OLMAMALI.
     *
     * Sebep: tarayıcı anahtarı HTTP referrer kısıtlı; sunucudan gelen
     * isteklerin referrer'ı yok, Google onları REQUEST_DENIED ile
     * reddediyor. Bu anahtar Google Cloud Console'da IP adresi kısıtıyla
     * (uygulama sunucusunun çıkış IP'si) tanımlanmalı.
     *
     * Tanımsızsa geocoding tamamen devre dışı kalır: planlar koordinatsız
     * üretilir, harita sayfası "rota çizilemedi" der, üretim BAŞARISIZ
     * OLMAZ (bkz. src/lib/geocoding.ts).
     */
    GOOGLE_MAPS_SERVER_API_KEY: z.string().min(1).optional(),
  },
  client: {
    // Maps JS API tarayıcıda yüklendiği için bu anahtar zorunlu olarak public.
    // Google Cloud Console'da mutlaka HTTP referrer kısıtı tanımlayın.
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    OPENROUTER_MODEL_FALLBACK: process.env.OPENROUTER_MODEL_FALLBACK,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    APP_URL: process.env.APP_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
    TOGETHER_MODEL: process.env.TOGETHER_MODEL,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    GOOGLE_MAPS_SERVER_API_KEY: process.env.GOOGLE_MAPS_SERVER_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },
  // Docker image üretimi gibi env'siz build senaryoları için kaçış kapısı.
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
