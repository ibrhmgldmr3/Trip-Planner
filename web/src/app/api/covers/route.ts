import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, route } from "@/server/api";
import { getCityCover } from "@/server/covers";
import { clientIp, rateLimit } from "@/server/rate-limit";

const querySchema = z.object({
  city: z.string().trim().min(1, "Şehir bilgisi gerekli").max(80),
  country: z.string().trim().max(80).optional(),
});

/**
 * Şehrin kapak fotoğrafı. Açılış ve keşfet sayfaları da kullandığı için oturum
 * istemez; dış servise giden istekler önbellek ve hız sınırıyla korunur.
 */
export const GET = route(async (request) => {
  const limited = rateLimit(`covers:${clientIp(request.headers)}`, 120, 60 * 1000);
  if (!limited.ok) {
    throw new ApiError(429, "Çok fazla istek gönderildi.", { "Retry-After": String(limited.retryAfter) });
  }

  const params = new URL(request.url).searchParams;
  const { city, country } = querySchema.parse({
    city: params.get("city") ?? "",
    country: params.get("country") || undefined,
  });

  const cover = await getCityCover(city, country);
  return NextResponse.json(cover, {
    headers: { "Cache-Control": cover.imageUrl ? "public, max-age=86400" : "public, max-age=3600" },
  });
});
