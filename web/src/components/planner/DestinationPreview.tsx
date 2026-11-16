"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import CityCover from "@/components/CityCover";

/** Kapak isteği yazarken her tuşta atılmasın diye beklenen süre. */
const DEBOUNCE_MS = 700;
/** Bu uzunluktan kısa şehir adları için fotoğraf aranmaz. */
const MIN_CHARS = 3;

interface DestinationPreviewProps {
  /** Formdaki şehir alanının anlık değeri. */
  city: string;
  country?: string;
  /** Fotoğrafın sol üstündeki küçük etiket. */
  eyebrow: string;
  /** Şehir adının altındaki satır (ör. ülke). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Planlayıcıların özet kartı başlığı: yazılan şehrin kapak fotoğrafı.
 * Şehir adı en az 3 harf olup 700 ms değişmeden kalınca fotoğraf istenir;
 * o zamana kadar nötr bir renk geçişi gösterilir.
 */
export default function DestinationPreview({ city, country = "", eyebrow, meta, className = "h-44" }: DestinationPreviewProps) {
  const query = city.trim().length >= MIN_CHARS ? city.trim() : "";
  const countryQuery = country.trim();
  const [debounced, setDebounced] = useState({ city: query, country: countryQuery });

  useEffect(() => {
    const timer = setTimeout(() => setDebounced({ city: query, country: countryQuery }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, countryQuery]);

  const name = city.trim();
  const overlay = (
    <>
      <div className="scrim absolute inset-0" aria-hidden="true" />
      <span className="glass absolute left-4 top-4 inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold">
        {eyebrow}
      </span>
      <div className="absolute inset-x-5 bottom-6 text-white">
        <p className="line-clamp-2 break-words font-display text-2xl font-extrabold leading-tight">
          {name || "Şehir seç"}
        </p>
        {meta && <p className="mt-0.5 truncate text-sm text-white/80">{meta}</p>}
      </div>
    </>
  );

  if (!debounced.city) {
    return (
      <div
        className={`relative isolate overflow-hidden ${className}`}
        style={{ background: "linear-gradient(135deg, var(--brand) 0%, var(--accent) 55%, var(--lav) 100%)" }}
      >
        <MapPin className="absolute -right-4 -top-3 h-32 w-32 text-white/15" aria-hidden="true" />
        {overlay}
      </div>
    );
  }

  return (
    <CityCover city={debounced.city} country={debounced.country || null} className={className} eager credit>
      {overlay}
    </CityCover>
  );
}
