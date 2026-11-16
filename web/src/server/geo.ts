import { env } from "@/env";
import { prisma } from "@/lib/prisma";

import { distanceKm, type Coordinates } from "@/lib/route";

export { distanceKm, type Coordinates };

export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    // (0, 0) modellerin "bilmiyorum" yerine uydurduğu tipik değerdir.
    !(latitude === 0 && longitude === 0)
  );
}

/**
 * Şehir merkezinden bu kadar uzaktaki duraklar hatalı konum sayılır.
 * Günübirlik gezi mesafelerini (ör. İzmir–Efes ≈ 60 km) kapsar, komşu büyük
 * şehirleri (ör. Bursa–İstanbul ≈ 90 km) dışarıda bırakır.
 */
export const MAX_STOP_DISTANCE_KM = 80;

/**
 * Bir durağın koordinatını doğrular. Dil modelleri koordinat uydurabildiği için
 * geçersiz ya da şehirden çok uzak değerler atılır; durak haritada gösterilmez
 * ama planda kalır.
 */
export function sanitizeStopCoordinates(
  latitude: unknown,
  longitude: unknown,
  center: Coordinates | null
): Coordinates | null {
  if (!isValidCoordinate(latitude, longitude)) return null;
  const point = { latitude: latitude as number, longitude: longitude as number };
  if (center && distanceKm(center, point) > MAX_STOP_DISTANCE_KM) return null;
  return point;
}

const cacheKey = (city: string, country?: string | null) =>
  [city, country ?? ""].map((part) => part.trim().toLocaleLowerCase("tr-TR")).join("|");

/**
 * Şehir merkezinin koordinatını bulur (OpenStreetMap Nominatim).
 * Sonuçlar veritabanında önbelleğe alınır; servis yanıt vermezse null döner ve
 * plan haritasız kaydedilir.
 */
export async function geocodeCity(city: string, country?: string | null): Promise<Coordinates | null> {
  const key = cacheKey(city, country);

  const cached = await prisma.geoCache.findUnique({ where: { query: key } });
  if (cached) {
    return cached.latitude !== null && cached.longitude !== null
      ? { latitude: cached.latitude, longitude: cached.longitude }
      : null;
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", country ? `${city}, ${country}` : city);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("accept-language", "tr");

    const response = await fetch(url, {
      headers: { "User-Agent": env.GEOCODER_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;

    const results = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = results[0];
    const latitude = first ? Number(first.lat) : NaN;
    const longitude = first ? Number(first.lon) : NaN;
    const found = isValidCoordinate(latitude, longitude);

    // Bulunamayan şehirler de kaydedilir ki her istekte yeniden sorulmasın.
    await prisma.geoCache.upsert({
      where: { query: key },
      update: {},
      create: {
        query: key,
        name: first?.display_name?.slice(0, 200) ?? null,
        latitude: found ? latitude : null,
        longitude: found ? longitude : null,
      },
    });

    return found ? { latitude, longitude } : null;
  } catch (error) {
    console.warn("[geo] Şehir koordinatı alınamadı:", error instanceof Error ? error.message : error);
    return null;
  }
}
