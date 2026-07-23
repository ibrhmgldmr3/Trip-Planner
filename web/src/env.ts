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
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },
  // Docker image üretimi gibi env'siz build senaryoları için kaçış kapısı.
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
