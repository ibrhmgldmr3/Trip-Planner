import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    ORS_API_KEY: z.string().min(1),
    OPENTRIPMAP_API_KEY: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1),
    GOOGLE_MAPS_API_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_MAP_TILES: z.string().url().optional(),
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    ORS_API_KEY: process.env.ORS_API_KEY,
    OPENTRIPMAP_API_KEY: process.env.OPENTRIPMAP_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_MAP_TILES: process.env.NEXT_PUBLIC_MAP_TILES,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },
});
