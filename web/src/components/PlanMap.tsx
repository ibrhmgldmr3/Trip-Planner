"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { PlanDay } from "@/lib/plan";

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
          position: [stop.latitude as number, stop.longitude as number] as [number, number],
        })),
    }))
    .filter((day) => day.stops.length > 0);
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
function FitBounds({ points, fallback }: { points: Array<[number, number]>; fallback: [number, number] | null }) {
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
export default function PlanMap({ center, days, activeDay, className = "" }: PlanMapProps) {
  const all = useMemo(() => mapDays(days), [days]);
  const visible = activeDay === null ? all : all.filter((day) => day.dayNumber === activeDay);
  const points = visible.flatMap((day) => day.stops.map((stop) => stop.position));
  const fallback: [number, number] | null = center ? [center.latitude, center.longitude] : null;
  const initial = points[0] ?? fallback ?? [39, 35];

  return (
    <MapContainer
      center={initial}
      zoom={12}
      scrollWheelZoom={false}
      className={`plan-map z-0 ${className}`}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanları'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitBounds points={points} fallback={fallback} />

      {visible.map((day) => (
        <Polyline
          key={`route-${day.dayNumber}`}
          positions={day.stops.map((stop) => stop.position)}
          pathOptions={{ className: `map-route map-route-${day.colorIndex}`, weight: 3 }}
        />
      ))}

      {visible.flatMap((day, dayIndex) =>
        day.stops.map((stop, stopIndex) => (
          <Marker
            key={stop.id}
            position={stop.position}
            icon={pinIcon(stop.label, day.colorIndex, dayIndex * 3 + stopIndex)}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              <strong>{stop.name}</strong>
              {activeDay === null ? ` · ${day.dayNumber}. gün` : ""}
            </Tooltip>
          </Marker>
        ))
      )}
    </MapContainer>
  );
}
