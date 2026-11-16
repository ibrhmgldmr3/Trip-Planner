"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Cover {
  imageUrl: string | null;
  pageUrl: string | null;
}

// Aynı şehir sayfada birçok kartta geçebilir: istekler tekilleştirilir ve oturum boyunca saklanır.
const cache = new Map<string, Promise<Cover>>();

function loadCover(city: string, country?: string | null): Promise<Cover> {
  const key = `${city.trim().toLocaleLowerCase("tr-TR")}|${(country ?? "").trim().toLocaleLowerCase("tr-TR")}`;
  let pending = cache.get(key);
  if (!pending) {
    const params = new URLSearchParams({ city: city.trim() });
    if (country?.trim()) params.set("country", country.trim());
    pending = fetch(`/api/covers?${params}`)
      .then((response) => (response.ok ? (response.json() as Promise<Cover>) : { imageUrl: null, pageUrl: null }))
      .catch(() => ({ imageUrl: null, pageUrl: null }));
    cache.set(key, pending);
  }
  return pending;
}

/** Şehir adından her zaman aynı çıkan bir renk geçişi: fotoğraf yokken ya da yüklenirken görünür. */
export function coverGradient(city: string): string {
  let hash = 0;
  for (const char of city.trim().toLocaleLowerCase("tr-TR")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const palettes = [
    ["#6558e8", "#b9aeff", "#ffc9a8"],
    ["#3b3fb8", "#7c6cf2", "#f0a6ca"],
    ["#2d2a6e", "#6558e8", "#8fd3f4"],
    ["#4b3fc4", "#9f8cff", "#ffd6a5"],
    ["#28306e", "#5b7cf0", "#b9aeff"],
  ];
  const [from, via, to] = palettes[hash % palettes.length];
  return `linear-gradient(${120 + (hash % 60)}deg, ${from} 0%, ${via} 55%, ${to} 100%)`;
}

interface CityCoverProps {
  city: string;
  country?: string | null;
  /** Kapsayıcının sınıfları; boyut ve köşe yuvarlaklığı buradan verilir. */
  className?: string;
  /** Görsele eklenecek sınıflar (ör. hover yakınlaşması için "zoom-img"). */
  imageClassName?: string;
  /** Fotoğrafın üzerine binen içerik (başlık, rozetler…). */
  children?: ReactNode;
  /** Fotoğraf kaynağına küçük bir bağlantı göster (ayrıntı sayfaları için). */
  credit?: boolean;
  /** Görünür alana girmeden yükle (sayfanın ilk ekranındaki kapaklar için). */
  eager?: boolean;
  /**
   * Fotoğraf adresi sunucuda zaten biliniyorsa (ör. keşfet listesi) buradan verilir;
   * bileşen o zaman istek atmaz. `null` "fotoğraf yok" demektir.
   */
  src?: string | null;
  /** `src` ile birlikte: atıf bağlantısı için kaynak sayfa. */
  pageUrl?: string | null;
}

/**
 * Bir şehrin kapak fotoğrafı. Fotoğraf Wikipedia'dan gelir; bulunamazsa ya da
 * yüklenemezse şehre özgü bir renk geçişi gösterilir, düzen değişmez.
 */
export default function CityCover({
  city,
  country,
  className = "",
  imageClassName = "",
  children,
  credit = false,
  eager = false,
  src,
  pageUrl = null,
}: CityCoverProps) {
  const known = src !== undefined;
  const [cover, setCover] = useState<Cover | null>(known ? { imageUrl: src, pageUrl } : null);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Sunucuda çizilen görsel, sayfa etkileşime hazır olmadan yüklenmiş olabilir;
  // o durumda onLoad kaçırılır, bu yüzden tamamlanma durumu ayrıca denetlenir.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, [cover?.imageUrl]);

  useEffect(() => {
    if (known) {
      setCover({ imageUrl: src, pageUrl });
      return;
    }
    let active = true;
    setCover(null);
    setLoaded(false);
    if (city.trim()) {
      loadCover(city, country).then((result) => {
        if (active) setCover(result);
      });
    }
    return () => {
      active = false;
    };
  }, [city, country, known, src, pageUrl]);

  return (
    <div className={`relative isolate overflow-hidden ${className}`} style={{ background: coverGradient(city) }}>
      {cover?.imageUrl && (
        // Uzak kaynaklı, boyutu önceden bilinmeyen fotoğraf: next/image yerine düz <img>.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          src={cover.imageUrl}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setCover({ imageUrl: null, pageUrl: null })}
          className={`absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${imageClassName}`}
        />
      )}
      {children}
      {credit && cover?.imageUrl && cover.pageUrl && (
        <a
          href={cover.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="no-print absolute bottom-2 right-3 z-10 text-[0.65rem] font-medium text-white/70 hover:text-white"
        >
          Fotoğraf: Wikipedia
        </a>
      )}
    </div>
  );
}
