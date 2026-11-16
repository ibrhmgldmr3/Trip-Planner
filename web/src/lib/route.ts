// Duraklar arası rota yardımcıları (istemci ve sunucuda ortak, saf işlevler).

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

/** İki nokta arasındaki kuş uçuşu mesafe (km). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export type RouteProfile = "foot" | "car";

/** Bir günün durakları kuş uçuşu bu kadar km'yi geçmiyorsa rota yürüyerek hesaplanır. */
export const WALKABLE_KM = 5;

/** [enlem, boylam] noktalarının sırayla kuş uçuşu toplam uzunluğuna göre yürüyüş ya da araç. */
export function routeProfile(points: Array<[number, number]>): RouteProfile {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceKm(
      { latitude: points[i - 1][0], longitude: points[i - 1][1] },
      { latitude: points[i][0], longitude: points[i][1] }
    );
  }
  return total <= WALKABLE_KM ? "foot" : "car";
}

/**
 * Durakları verilen sırayla, yol ağı üzerinden bağlayan rotanın adresi
 * (FOSSGIS'in herkese açık OSRM sunucusu). OSRM koordinatı "boylam,enlem" bekler.
 */
export function routeUrl(points: Array<[number, number]>, profile: RouteProfile): string {
  const path = points.map(([lat, lng]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
  const [server, mode] = profile === "foot" ? ["routed-foot", "foot"] : ["routed-car", "driving"];
  return `https://routing.openstreetmap.de/${server}/route/v1/${mode}/${path}?overview=full&geometries=geojson`;
}

/** 850 → "850 m", 4230 → "4,2 km" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} km`;
}

/** 2520 → "42 dk", 4500 → "1 sa 15 dk" */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} dk`;
  const rest = minutes % 60;
  return rest === 0 ? `${minutes / 60} sa` : `${Math.floor(minutes / 60)} sa ${rest} dk`;
}
