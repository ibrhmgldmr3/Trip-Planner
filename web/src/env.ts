import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    GOOGLE_MAPS_API_KEY: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
    NEXT_PUBLIC_OPENROUTER_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    NEXT_PUBLIC_OPENROUTER_API_KEY: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
  },
});
