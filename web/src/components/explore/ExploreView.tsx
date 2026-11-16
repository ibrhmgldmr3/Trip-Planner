"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import CityCover from "@/components/CityCover";
import { EmptyState } from "@/components/States";
import {
  REGIONS,
  TRAVEL_TYPES,
  TYPE_LABEL,
  formatDays,
  type Destination,
  type Region,
  type TravelType,
} from "@/lib/destinations";

export type CoverUrls = Record<string, { imageUrl: string | null; pageUrl: string | null }>;

type DurationKey = "kisa" | "orta" | "uzun";
type SortKey = "onerilen" | "az" | "sure";

const DURATIONS: { value: DurationKey; label: string; test: (days: [number, number]) => boolean }[] = [
  { value: "kisa", label: "Hafta sonu · 1–2 gün", test: ([min]) => min <= 2 },
  { value: "orta", label: "3–4 gün", test: ([min, max]) => min <= 4 && max >= 3 },
  { value: "uzun", label: "5+ gün", test: ([, max]) => max >= 5 },
];

const SORTS: { value: SortKey; label: string }[] = [
  { value: "onerilen", label: "Önerilen" },
  { value: "az", label: "A–Z" },
  { value: "sure", label: "Süre (kısadan uzuna)" },
];

/** Aksan ve büyük/küçük harf farkını yok sayan arama anahtarı ("sanliurfa" → Şanlıurfa). */
const fold = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

interface ExploreViewProps {
  destinations: Destination[];
  covers: CoverUrls;
}

export default function ExploreView({ destinations, covers }: ExploreViewProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TravelType | null>(null);
  const [duration, setDuration] = useState<DurationKey | null>(null);
  const [region, setRegion] = useState<Region | "">("");
  const [sort, setSort] = useState<SortKey>("onerilen");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeCount = [type, duration, region].filter(Boolean).length;
  const dirty = activeCount > 0 || query.trim() !== "";

  const results = useMemo(() => {
    const needle = fold(query);
    const durationTest = DURATIONS.find((item) => item.value === duration)?.test;
    const list = destinations.filter(
      (destination) =>
        (!needle || fold(`${destination.name} ${destination.region}`).includes(needle)) &&
        (!type || destination.types.includes(type)) &&
        (!durationTest || durationTest(destination.days)) &&
        (!region || destination.region === region)
    );
    if (sort === "az") return [...list].sort((a, b) => a.name.localeCompare(b.name, "tr"));
    if (sort === "sure") return [...list].sort((a, b) => a.days[0] - b.days[0] || a.days[1] - b.days[1]);
    return list;
  }, [destinations, query, type, duration, region, sort]);

  const clear = () => {
    setQuery("");
    setType(null);
    setDuration(null);
    setRegion("");
  };

  return (
    <main className="flex-1">
      {/* Başlık bandı */}
      <section className="glow border-b border-line">
        <div className="mx-auto max-w-7xl px-5 pb-9 pt-10 md:px-8 md:pb-12 md:pt-14">
          <p className="eyebrow rise">Keşfet</p>
          <h1
            className="rise mt-2 font-display text-[1.9rem] font-extrabold leading-tight text-ink md:text-[2.5rem]"
            style={stagger(1)}
          >
            Türkiye’de keşfedilecek rotalar
          </h1>
          <p className="rise mt-2 max-w-2xl text-[0.98rem] leading-relaxed text-ink-2" style={stagger(2)}>
            Bir rota seç, şehir planlayıcıya hazır gelsin; tarihlerini ve tercihlerini orada eklersin.
          </p>

          <div className="rise relative mt-6 max-w-xl" style={stagger(3)}>
            <label htmlFor="explore-search" className="sr-only">
              Şehir ya da bölge ara
            </label>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
              aria-hidden="true"
            />
            <input
              id="explore-search"
              type="search"
              className="input h-12 rounded-full pl-11 shadow-soft"
              placeholder="Şehir ya da bölge ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:px-8 md:py-10 lg:grid-cols-[16.5rem_1fr] lg:gap-10">
        {/* Filtreler: geniş ekranda sol panel, dar ekranda açılır kapanır */}
        <aside aria-label="Filtreler">
          <button
            type="button"
            className="btn btn-outline w-full lg:hidden"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="explore-filters"
          >
            {filtersOpen ? <X /> : <SlidersHorizontal />}
            {filtersOpen ? "Filtreleri gizle" : "Filtreler"}
            {activeCount > 0 && (
              <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[0.7rem] font-bold text-on-brand">
                {activeCount}
              </span>
            )}
          </button>

          <div
            id="explore-filters"
            className={`card mt-3 p-5 lg:sticky lg:top-24 lg:mt-0 lg:block ${filtersOpen ? "block" : "hidden"}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Filtreler</h2>
              <button
                type="button"
                onClick={clear}
                disabled={!dirty}
                className="text-sm font-semibold text-brand transition-opacity hover:underline disabled:cursor-default disabled:opacity-40 disabled:hover:no-underline"
              >
                Temizle
              </button>
            </div>

            <FilterGroup title="Seyahat türü">
              <button type="button" className="chip" aria-pressed={type === null} onClick={() => setType(null)}>
                Tümü
              </button>
              {TRAVEL_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="chip"
                  aria-pressed={type === item.value}
                  onClick={() => setType(type === item.value ? null : item.value)}
                >
                  {item.label}
                </button>
              ))}
            </FilterGroup>

            <FilterGroup title="Süre">
              <button type="button" className="chip" aria-pressed={duration === null} onClick={() => setDuration(null)}>
                Tümü
              </button>
              {DURATIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="chip"
                  aria-pressed={duration === item.value}
                  onClick={() => setDuration(duration === item.value ? null : item.value)}
                >
                  {item.label}
                </button>
              ))}
            </FilterGroup>

            <div className="mt-6 border-t border-line pt-5">
              <label htmlFor="explore-region" className="field-label">
                Bölge
              </label>
              <select
                id="explore-region"
                className="input"
                value={region}
                onChange={(event) => setRegion(event.target.value as Region | "")}
              >
                <option value="">Tüm bölgeler</option>
                {REGIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        <section aria-labelledby="explore-results" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="explore-results" className="text-sm font-semibold text-ink-2" aria-live="polite">
              <span className="tabular text-ink">{results.length}</span> sonuç
            </h2>
            <div className="flex items-center gap-2">
              <label htmlFor="explore-sort" className="text-sm text-ink-3">
                Sırala
              </label>
              <select
                id="explore-sort"
                className="input h-10 w-auto rounded-full text-sm"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
              >
                {SORTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title="Bu filtrelere uyan rota yok"
              description="Birkaç filtreyi kaldırmayı dene ya da planlayıcıya istediğin şehri doğrudan yaz."
            >
              <button type="button" className="btn btn-primary" onClick={clear}>
                Filtreleri temizle
              </button>
              <Link href="/ai-planner" className="btn btn-outline">
                Başka bir şehir planla
              </Link>
            </EmptyState>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((destination, index) => (
                <li key={destination.name} className="rise" style={stagger(index)}>
                  <DestinationCard destination={destination} cover={covers[destination.name]} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6 border-t border-line pt-5">
      <legend className="sr-only">{title}</legend>
      <p className="mb-3 text-sm font-semibold text-ink" aria-hidden="true">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function DestinationCard({
  destination,
  cover,
}: {
  destination: Destination;
  cover?: { imageUrl: string | null; pageUrl: string | null };
}) {
  return (
    <Link
      href={`/ai-planner?city=${encodeURIComponent(destination.name)}`}
      className="card card-lift group flex h-full flex-col overflow-hidden"
    >
      <CityCover
        city={destination.name}
        src={cover?.imageUrl ?? null}
        pageUrl={cover?.pageUrl ?? null}
        imageClassName="zoom-img"
        className="h-56 rounded-t-[1.25rem] sm:h-60"
      >
        <span className="glass absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {destination.region}
        </span>
      </CityCover>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-bold text-ink">{destination.name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-ink-3" aria-hidden="true" />
            <span className="tabular">{formatDays(destination.days)}</span>
          </span>
          <span className="text-ink-3" aria-hidden="true">
            ·
          </span>
          {destination.types.slice(0, 3).map((item) => (
            <span key={item} className="tag">
              {TYPE_LABEL[item]}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-1 items-end gap-4">
          <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-ink-2">{destination.blurb}</p>
          <span
            className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-on-brand"
            aria-hidden="true"
          >
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
