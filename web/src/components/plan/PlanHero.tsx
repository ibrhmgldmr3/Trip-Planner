"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  BedDouble,
  CalendarDays,
  CircleCheck,
  Compass,
  Ellipsis,
  MapPin,
  PencilLine,
  Printer,
  RotateCcw,
  Route,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import CityCover from "@/components/CityCover";
import StatusBadge from "@/components/StatusBadge";
import { formatDateRange, formatMoney } from "@/lib/format";
import { canCancel, canMarkDone, canRestore, stripLeadingHeading, type PlanDetail, type PlanStatus } from "@/lib/plan";

interface PlanHeroProps {
  plan: PlanDetail;
  status: PlanStatus;
  manual: boolean;
  dayCount: number;
  total: number | null;
  /** Haritada gösterilebilen (konumu olan) durak sayısı. */
  locatedStops: number;
  busy: boolean;
  onMarkDone: () => void;
  onCancel: () => void;
  onRestore: () => void;
  onDelete: () => void;
  /** Günlük plan sekmesini açar, o günü haritada seçer ve güne kaydırır. */
  onSelectDay: (dayNumber: number) => void;
  /** Günlük plan sekmesini (haritayla birlikte) açar. */
  onOpenMap: () => void;
}

const MAX_INTERESTS = 4;

/**
 * Şehir rehberinin ilk paragrafından kısa bir tanıtım cümlesi çıkarır.
 * Markdown işaretleri atılır, metin cümle sınırında (olmazsa sözcük sınırında) kısaltılır.
 */
function guideSummary(markdown: string | null, max = 160): string | null {
  if (!markdown) return null;
  const paragraph = stripLeadingHeading(markdown)
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => !/^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>)/.test(line))
        .join(" ")
    )
    .map((text) =>
      text
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`~#>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .find((text) => text.length >= 20);
  if (!paragraph) return null;

  const sentences = paragraph.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [paragraph];
  let result = "";
  for (const sentence of sentences) {
    const next = (result + " " + sentence.trim()).trim();
    if (next.length > max) break;
    result = next;
  }
  if (result) return result;

  // İlk cümle bile uzunsa sözcük sınırında kesilir.
  const cut = paragraph.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max).replace(/[,;:\s]+$/, "")}…`;
}

/** q3'teki fotoğraflı kapak: başlık, meta satırı, özellik etiketleri, eylemler, gün kartları ve harita kartı. */
export default function PlanHero({
  plan,
  status,
  manual,
  dayCount,
  total,
  locatedStops,
  busy,
  onMarkDone,
  onCancel,
  onRestore,
  onDelete,
  onSelectDay,
  onOpenMap,
}: PlanHeroProps) {
  const stopCount = plan.days.reduce((sum, day) => sum + day.stops.length, 0);
  const description =
    guideSummary(plan.cityGuide) ??
    `${dayCount > 0 ? `${dayCount} günlük` : "Esnek tarihli"} ${plan.city} planı${
      stopCount > 0 ? `, ${stopCount} durakla` : ""
    }.`;

  const features: Array<{ key: string; icon: React.ReactNode; label: string }> = [
    manual
      ? { key: "source", icon: <PencilLine />, label: "Manuel plan" }
      : { key: "source", icon: <Sparkles />, label: "AI planı" },
  ];
  if (plan.transport?.type) features.push({ key: "transport", icon: <Route />, label: plan.transport.type });
  if (plan.accommodation?.type || plan.accommodation?.name) {
    features.push({
      key: "stay",
      icon: <BedDouble />,
      label: (plan.accommodation.type || plan.accommodation.name) as string,
    });
  }
  plan.interests.slice(0, MAX_INTERESTS).forEach((interest) => {
    features.push({ key: `interest-${interest}`, icon: <Compass />, label: interest });
  });
  const hiddenInterests = plan.interests.length - MAX_INTERESTS;

  const markDone = canMarkDone(plan);
  const hasDates = !!(plan.startDate || plan.endDate);
  const showStrip = plan.days.length > 0;

  return (
    <>
      {/* Yazdırırken fotoğraf yerine sade bir başlık basılır. */}
      <header className="hidden print:block">
        <h1 className="font-display text-4xl font-extrabold">{plan.city}</h1>
        <p className="mt-1 text-sm">
          {[
            plan.country,
            formatDateRange(plan.startDate, plan.endDate),
            dayCount > 0 ? `${dayCount} gün` : null,
            plan.travelers > 1 ? `${plan.travelers} kişi` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <section className="no-print rise" aria-label={`${plan.city} planı`}>
        <CityCover
          city={plan.city}
          country={plan.country}
          eager
          credit
          className="flex min-h-[32rem] flex-col rounded-[1.75rem] shadow-float md:min-h-[38rem]"
        >
          <div className="scrim-left absolute inset-0" aria-hidden />
          <div className="scrim absolute inset-0" aria-hidden />

          <div className="relative flex flex-1 flex-col p-5 sm:p-8 md:p-10">
            <Link
              href="/my-plans"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Planlarıma dön
            </Link>

            <div className="mt-8 max-w-2xl md:mt-12">
              <h1 className="break-words font-display text-[2.6rem] font-extrabold leading-[1.02] text-white sm:text-6xl md:text-7xl">
                {plan.city}
              </h1>

              <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-white/90 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:flex-none">
                <li>
                  <StatusBadge status={status} onPhoto />
                </li>
                {plan.country && (
                  <li className="flex items-center gap-1.5">
                    <MapPin />
                    {plan.country}
                  </li>
                )}
                <li className="flex items-center gap-1.5">
                  <CalendarDays />
                  {dayCount > 0 ? `${dayCount} gün` : "Esnek tarih"}
                </li>
                {total !== null && (
                  <li className="tabular flex items-center gap-1.5">
                    <Wallet />
                    {formatMoney(total)}
                  </li>
                )}
                {plan.travelers > 1 && (
                  <li className="flex items-center gap-1.5">
                    <Users />
                    {plan.travelers} kişi
                  </li>
                )}
                {hasDates && <li className="tabular text-white/75">{formatDateRange(plan.startDate, plan.endDate)}</li>}
              </ul>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">{description}</p>

              <ul className="mt-6 flex flex-wrap gap-2">
                {features.map((feature) => (
                  <li
                    key={feature.key}
                    className="glass inline-flex h-9 max-w-full items-center gap-2 rounded-full px-3.5 text-sm font-medium [&_svg]:h-4 [&_svg]:w-4 [&_svg]:flex-none"
                  >
                    {feature.icon}
                    <span className="truncate">{feature.label}</span>
                  </li>
                ))}
                {hiddenInterests > 0 && (
                  <li
                    className="glass inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium"
                    title={plan.interests.slice(MAX_INTERESTS).join(", ")}
                  >
                    +{hiddenInterests}
                  </li>
                )}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {markDone ? (
                  <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={onMarkDone}>
                    <CircleCheck />
                    Gerçekleşti olarak işaretle
                  </button>
                ) : (
                  <Link href={`/budget?plan=${plan.id}`} className="btn btn-primary btn-lg">
                    <Wallet />
                    Harcamaları takip et
                  </Link>
                )}
                {markDone && (
                  <Link
                    href={`/budget?plan=${plan.id}`}
                    className="btn btn-glass btn-icon h-12 w-12"
                    aria-label="Harcamaları takip et"
                    title="Harcamaları takip et"
                  >
                    <Wallet />
                  </Link>
                )}
                <button
                  type="button"
                  className="btn btn-glass btn-icon h-12 w-12"
                  onClick={() => window.print()}
                  aria-label="Yazdır"
                  title="Yazdır"
                >
                  <Printer />
                </button>
                <ActionsMenu
                  busy={busy}
                  canCancel={canCancel(status)}
                  canRestore={canRestore(status)}
                  onCancel={onCancel}
                  onRestore={onRestore}
                  onDelete={onDelete}
                />
              </div>
            </div>

            {(showStrip || locatedStops > 0) && (
              <div className="mt-auto flex items-end gap-4 pt-10">
                {showStrip && (
                  <ol
                    className="-mx-1 flex min-w-0 flex-1 snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
                    aria-label="Günler"
                  >
                    {plan.days.map((day, index) => (
                      <li key={day.id} className="flex-none snap-start">
                        <button
                          type="button"
                          onClick={() => onSelectDay(day.dayNumber)}
                          className="glass flex h-full w-44 flex-col rounded-2xl p-3.5 text-left transition-colors hover:bg-white/25 sm:w-48"
                        >
                          <span className="flex items-center gap-2 text-xs font-semibold text-white/80">
                            <span
                              className="day-dot tabular grid h-6 w-6 place-items-center rounded-full text-[0.7rem] font-bold"
                              data-color={index % 5}
                            >
                              {day.dayNumber}
                            </span>
                            {day.dayNumber}. gün
                          </span>
                          <span className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
                            {day.title || `${day.dayNumber}. gün programı`}
                          </span>
                          <span className="mt-auto pt-2 text-xs text-white/70">
                            {day.isFree
                              ? "Serbest gün"
                              : day.stops.length > 0
                                ? `${day.stops.length} durak`
                                : "Durak eklenmemiş"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}

                {locatedStops > 0 && (
                  <button
                    type="button"
                    onClick={onOpenMap}
                    className="glass ml-auto hidden w-56 flex-none overflow-hidden rounded-2xl text-left transition-colors hover:bg-white/25 md:block"
                  >
                    <span className="relative block h-20" aria-hidden>
                      {/* Süs amaçlı küçük rota çizimi; gerçek harita sekmede açılır. */}
                      <svg viewBox="0 0 224 80" className="absolute inset-0 h-full w-full" fill="none">
                        <path
                          d="M18 62 C 60 20, 96 70, 130 38 S 190 22, 206 30"
                          stroke="rgb(255 255 255 / 0.55)"
                          strokeWidth="2"
                          className="route-dash"
                        />
                        <circle cx="18" cy="62" r="4" fill="rgb(255 255 255 / 0.8)" />
                        <circle cx="206" cy="30" r="4" fill="rgb(255 255 255 / 0.8)" />
                      </svg>
                      <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-on-brand shadow-lift">
                        <MapPin className="h-4 w-4" />
                      </span>
                    </span>
                    <span className="block border-t border-white/20 px-4 py-3">
                      <span className="block text-sm font-semibold">Haritada {locatedStops} durak</span>
                      <span className="block truncate text-xs text-white/75">
                        {[plan.city, plan.country].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </CityCover>
      </section>
    </>
  );
}

interface ActionsMenuProps {
  busy: boolean;
  canCancel: boolean;
  canRestore: boolean;
  onCancel: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

/**
 * İptal / geri al / sil eylemlerini toplayan küçük menü. Kapak taşmayı kestiği için
 * yukarı ve düğmeye ortalı açılır; dar ekranda düğme alt satıra düşse de kenara taşmaz.
 */
function ActionsMenu({ busy, canCancel, canRestore, onCancel, onRestore, onDelete }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-glass btn-icon h-12 w-12"
        aria-label="Diğer işlemler"
        title="Diğer işlemler"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Plan işlemleri"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-float"
        >
          {canCancel && (
            <button
              type="button"
              role="menuitem"
              className={`${itemClass} text-ink-2 hover:bg-canvas-2 hover:text-ink`}
              disabled={busy}
              onClick={() => run(onCancel)}
            >
              <Ban />
              Planı iptal et
            </button>
          )}
          {canRestore && (
            <button
              type="button"
              role="menuitem"
              className={`${itemClass} text-ink-2 hover:bg-canvas-2 hover:text-ink`}
              disabled={busy}
              onClick={() => run(onRestore)}
            >
              <RotateCcw />
              İptali geri al
            </button>
          )}
          {(canCancel || canRestore) && <hr className="dash-rule mx-2 my-1" />}
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} text-rose hover:bg-rose-soft`}
            disabled={busy}
            onClick={() => run(onDelete)}
          >
            <Trash2 />
            Planı sil
          </button>
        </div>
      )}
    </div>
  );
}
