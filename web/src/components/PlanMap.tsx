"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { PlanDay } from "@/lib/plan";
import {
  formatDistance,
  formatDuration,
  routeProfile,
  routeUrl,
  type RouteProfile,
} from "@/lib/route";

interface PlanMapProps {
  center: { latitude: number; longitude: number } | null;
  days: PlanDay[];
  /** Yalnızca bu günün rotası gösterilir; null ise tüm günler. */
  activeDay: number | null;
  className?: string;
}

interface MapStop {
  id: string;
  name: string;
  label: string;
  position: [number, number];
}

interface MapDay {
  dayNumber: number;
  colorIndex: number;
  stops: MapStop[];
}

const DAY_COLORS = 5;

/** Günlerin konumu olan duraklarını harita verisine çevirir. Numaralar gün içi sıradır. */
export function mapDays(days: PlanDay[]): MapDay[] {
  return days
    .map((day, index) => ({
      dayNumber: day.dayNumber,
      colorIndex: index % DAY_COLORS,
      stops: day.stops
        .filter((stop) => stop.latitude !== null && stop.longitude !== null)
        .map((stop, order) => ({
          id: stop.id,
          name: stop.name,
          label: String(order + 1),
          position: [stop.latitude as number, stop.longitude as number] as [
            number,
            number,
          ],
        })),
    }))
    .filter((day) => day.stops.length > 0);
}

/* ------------------------------- Rota ------------------------------- */

interface Route {
  /** Yol ağı üzerindeki çizgi: [enlem, boylam] noktaları. */
  line: Array<[number, number]>;
  meters: number;
  seconds: number;
  profile: RouteProfile;
}

const routeKey = (points: Array<[number, number]>) =>
  points.map((point) => point.join(",")).join(";");

// Aynı rota oturum boyunca bir kez sorulur. Herkese açık rota sunucusunu yormamak
// için istekler art arda gönderilir ("tüm günler" görünümünde gün sayısı kadar istek olur).
const routeCache = new Map<string, Promise<Route | null>>();
let routeQueue: Promise<unknown> = Promise.resolve();

/**
 * Durakları ziyaret sırasıyla, yol ağı üzerinden en kısa/hızlı şekilde bağlayan rota.
 * Sunucuya ulaşılamazsa ya da rota bulunamazsa null döner; harita düz çizgiye geri düşer.
 */
function loadRoute(points: Array<[number, number]>): Promise<Route | null> {
  const key = routeKey(points);
  let pending = routeCache.get(key);
  if (!pending) {
    const profile = routeProfile(points);
    const request = async (): Promise<Route | null> => {
      try {
        const response = await fetch(routeUrl(points, profile), {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return null;
        const data = (await response.json()) as {
          code?: string;
          routes?: Array<{
            distance: number;
            duration: number;
            geometry?: { coordinates?: Array<[number, number]> };
          }>;
        };
        const best = data.routes?.[0];
        const coordinates = best?.geometry?.coordinates;
        if (
          data.code !== "Ok" ||
          !best ||
          !coordinates ||
          coordinates.length < 2
        )
          return null;
        return {
          line: coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
          meters: best.distance,
          seconds: best.duration,
          profile,
        };
      } catch {
        return null;
      }
    };
    pending = routeQueue.then(request);
    routeQueue = pending;
    routeCache.set(key, pending);
    // Geçici hata kalıcı olmasın: başarısız sonuç önbellekten çıkarılır.
    pending.then((route) => {
      if (!route) routeCache.delete(key);
    });
  }
  return pending;
}

/** `order`, iğnenin haritadaki sırasıdır; iğneler bu sırayla belirir. */
function pinIcon(label: string, colorIndex: number, order: number) {
  return L.divIcon({
    className: "",
    html: `<span class="map-pin" data-color="${colorIndex}" style="--i:${order}">${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Görünen noktalar değişince haritayı onlara sığdırır. */
function FitBounds({
  points,
  fallback,
}: {
  points: Array<[number, number]>;
  fallback: [number, number] | null;
}) {
  const map = useMap();
  const key = points.map((point) => point.join(",")).join(";");

  // Leaflet kapsayıcının boyutunu yalnızca kurulurken ölçer. Kapsayıcı sonradan
  // boyut değiştirirse (sekme açılması, pencere, yapışkan panel) karolar eksik
  // yüklenir; boyut her değiştiğinde yeniden ölçtürülür.
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    map.invalidateSize();
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    } else if (fallback) {
      map.setView(fallback, 11);
    }
    // `key` noktaların içeriğini temsil eder; dizi kimliği her çizimde değişir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

/** Planın duraklarını ve gün gün rotasını gösteren harita (OpenStreetMap). */
export default function PlanMap({
  center,
  days,
  activeDay,
  className = "",
}: PlanMapProps) {
  const all = useMemo(() => mapDays(days), [days]);
  const visible =
    activeDay === null ? all : all.filter((day) => day.dayNumber === activeDay);
  const points = visible.flatMap((day) =>
    day.stops.map((stop) => stop.position),
  );
  const fallback: [number, number] | null = center
    ? [center.latitude, center.longitude]
    : null;
  const initial = points[0] ?? fallback ?? [39, 35];

  // Görünen günlerin yol rotaları; anahtar durakların koordinat dizisidir.
  const [routes, setRoutes] = useState<Record<string, Route>>({});
  const wanted = visible
    .filter((day) => day.stops.length > 1)
    .map((day) => routeKey(day.stops.map((stop) => stop.position)));
  const wantedKey = wanted.join("|");

  useEffect(() => {
    let active = true;
    for (const day of visible) {
      if (day.stops.length < 2) continue;
      const stops = day.stops.map((stop) => stop.position);
      loadRoute(stops).then((route) => {
        if (active && route)
          setRoutes((prev) => ({ ...prev, [routeKey(stops)]: route }));
      });
    }
    return () => {
      active = false;
    };
    // `wantedKey` görünen rotaların içeriğini temsil eder; `visible` her çizimde yeni dizidir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey]);

  // Özet yalnızca görünen tüm rotalar yol üzerinden hesaplandıysa gösterilir.
  const ready =
    wanted.length > 0 && wanted.every((key) => routes[key])
      ? wanted.map((key) => routes[key])
      : null;
  const summary = ready && {
    meters: ready.reduce((sum, route) => sum + route.meters, 0),
    seconds: ready.reduce((sum, route) => sum + route.seconds, 0),
    // Günler farklı yollarla gidiliyorsa tek bir süre yanıltıcı olur.
    profile: ready.every((route) => route.profile === ready[0].profile)
      ? ready[0].profile
      : null,
  };

  return (
    <div className={`relative h-full ${className}`}>
      <MapContainer
        center={initial}
        zoom={12}
        scrollWheelZoom={false}
        className="plan-map z-0"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanları'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitBounds points={points} fallback={fallback} />

        {visible.map((day) => {
          const stops = day.stops.map((stop) => stop.position);
          const route = routes[routeKey(stops)];
          // Yol rotası gelene kadar (ya da gelmezse) duraklar düz, kesikli çizgiyle bağlanır.
          // Sınıf yalnızca kurulurken uygulandığı için iki durumun anahtarı ayrıdır.
          return route ? (
            <Polyline
              key={`road-${day.dayNumber}`}
              positions={route.line}
              pathOptions={{
                className: `map-route map-route-road map-route-${day.colorIndex}`,
                weight: 4,
              }}
            />
          ) : (
            <Polyline
              key={`line-${day.dayNumber}`}
              positions={stops}
              pathOptions={{
                className: `map-route map-route-${day.colorIndex}`,
                weight: 3,
              }}
            />
          );
        })}

        {visible.flatMap((day, dayIndex) =>
          day.stops.map((stop, stopIndex) => (
            <Marker
              key={stop.id}
              position={stop.position}
              icon={pinIcon(
                stop.label,
                day.colorIndex,
                dayIndex * 3 + stopIndex,
              )}
            >
              <Tooltip direction="top" offset={[0, -12]}>
                <strong>{stop.name}</strong>
                {activeDay === null ? ` · ${day.dayNumber}. gün` : ""}
              </Tooltip>
            </Marker>
          )),
        )}
      </MapContainer>
      {summary && (
        <p className="glass-light pointer-events-none absolute right-3 top-3 z-10 rounded-full px-3 py-1.5 text-xs font-semibold text-ink shadow-soft tabular">
          {formatDistance(summary.meters)}
          {summary.profile &&
            ` · ${formatDuration(summary.seconds)} ${summary.profile === "foot" ? "yürüyerek" : "araçla"}`}
        </p>
      )}
    </div>
  );
}
