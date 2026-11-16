import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Sunucu ortam değişkenleri. Yalnızca gerçekten kullanılanlar tanımlıdır;
 * tarayıcıya giden (NEXT_PUBLIC_) hiçbir gizli değer yoktur.
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET en az 16 karakter olmalı"),
    NEXTAUTH_URL: z.string().url().optional(),

    // AI plan üretimi. Anahtar yoksa uygulama çalışır, yalnızca AI ucu 503 döner.
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_MODEL: z.string().min(1).default("deepseek/deepseek-r1-0528-qwen3-8b:free"),
    OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),

    // Google ile giriş: ikisi de tanımlıysa etkinleşir.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    // Şehir koordinatı için kullanılan Nominatim, isteklerde uygulamayı tanıtan bir
    // User-Agent ister (https://operations.osmfoundation.org/policies/nominatim/).
    GEOCODER_USER_AGENT: z.string().min(1).default("TripPlanner/1.0"),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GEOCODER_USER_AGENT: process.env.GEOCODER_USER_AGENT,
  },
  emptyStringAsUndefined: true,
  // Yalnızca ortam değişkeni olmadan derleme denemek için (CI lint vb.).
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
