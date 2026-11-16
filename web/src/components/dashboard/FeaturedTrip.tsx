"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Users } from "lucide-react";
import CityCover from "@/components/CityCover";
import StatusBadge from "@/components/StatusBadge";
import PlanActions, { SourceTag } from "./PlanActions";
import { formatDateRange, todayISO, tripDays, tripNights } from "@/lib/format";
import { CHECKLIST_ITEMS, effectiveStatus, type PlanSummary, type StoredStatus } from "@/lib/plan";

/**
 * Panelde öne çıkarılacak plan: önce şu an sürmekte olan, sonra başlangıcı en yakın
 * olan yaklaşan plan, yoksa iptal edilmemiş en yeni plan.
 */
export function pickFeatured(plans: PlanSummary[]): PlanSummary | null {
  const today = todayISO();
  const active = plans.find((plan) => effectiveStatus(plan) === "ACTIVE");
  if (active) return active;

  const upcoming = plans
    .filter((plan) => effectiveStatus(plan) === "PLANNED" && plan.startDate && plan.startDate > today)
    .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  if (upcoming[0]) return upcoming[0];

  return plans.find((plan) => effectiveStatus(plan) !== "CANCELLED") ?? null;
}

/** Kartın sağ üstündeki başlık ve geri sayım satırı; tarihler yerel güne göre hesaplanır. */
function timeline(plan: PlanSummary): { eyebrow: string; line: string | null } {
  const status = effectiveStatus(plan);
  const today = todayISO();

  if (status === "ACTIVE" && plan.startDate) {
    const day = tripNights(plan.startDate, today) + 1;
    const total = tripDays(plan.startDate, plan.endDate);
    return { eyebrow: "Şu an yoldasın", line: `Gezinin ${day}. günü, toplam ${total} gün` };
  }
  if (status === "PLANNED" && plan.startDate && plan.startDate > today) {
    const left = tripNights(today, plan.startDate);
    return { eyebrow: "Sıradaki gezin", line: left === 1 ? "Yarın yola çıkıyorsun" : `${left} gün kaldı` };
  }
  if (status === "PLANNED") {
    return { eyebrow: "Son planın", line: plan.startDate ? null : "Tarihleri belirleyince geri sayım başlar" };
  }
  if (status === "COMPLETED") {
    return { eyebrow: "Son planın", line: "Tarihi geçti; gezi defterine ekleyebilirsin" };
  }
  return { eyebrow: "Son gezin", line: "Gezi defterinde" };
}

interface FeaturedTripProps {
  plan: PlanSummary;
  busy?: boolean;
  onStatus: (status: StoredStatus) => void;
  onDelete: () => void;
}

/** Panelin üstündeki büyük kart: solda şehir fotoğrafı, sağda hazırlık listesi. */
export default function FeaturedTrip({ plan, busy = false, onStatus, onDelete }: FeaturedTripProps) {
  const status = effectiveStatus(plan);
  const days = tripDays(plan.startDate, plan.endDate);
  const href = `/plan-detail/${plan.id}`;
  const { eyebrow, line } = timeline(plan);

  const doneCount = CHECKLIST_ITEMS.filter((item) => plan.checklist[item.key]).length;
  const ratio = doneCount / CHECKLIST_ITEMS.length;

  return (
    <section
      aria-label={`Öne çıkan plan: ${plan.city}`}
      className="card grid overflow-hidden md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <Link href={href} tabIndex={-1} aria-hidden="true" className="group block">
        <CityCover
          city={plan.city}
          country={plan.country}
          className="h-full min-h-[15rem] sm:min-h-[18rem] md:min-h-[21rem]"
          imageClassName="zoom-img"
          eager
        >
          <div className="scrim absolute inset-0" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
            <StatusBadge status={status} onPhoto />
            <SourceTag source={plan.source} />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-6">
            {plan.country && <p className="text-sm font-medium text-white/80">{plan.country}</p>}
            <p className="break-words font-display text-3xl font-extrabold leading-tight md:text-4xl">{plan.city}</p>
            <p className="tabular mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/90 [&_svg]:h-4 [&_svg]:w-4">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays />
                {days > 0 ? `${days} gün · ` : ""}
                {formatDateRange(plan.startDate, plan.endDate)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Users />
                {plan.travelers} kişi
              </span>
            </p>
          </div>
        </CityCover>
      </Link>

      <div className="flex flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{eyebrow}</p>
            {line && <p className="tabular mt-1 font-display text-lg font-bold leading-snug text-ink">{line}</p>}
          </div>
          <PlanActions plan={plan} busy={busy} onStatus={onStatus} onDelete={onDelete} className="-mr-2 -mt-1.5" />
        </div>

        <ul className="mt-5 space-y-3" aria-label="Plan hazırlığı">
          {CHECKLIST_ITEMS.map((item) => {
            const done = plan.checklist[item.key];
            return (
              <li key={item.key} className="flex items-center gap-3 text-[0.95rem]">
                <span className="check" data-done={String(done)} aria-hidden="true">
                  <Check strokeWidth={3} />
                </span>
                <span className={done ? "font-medium text-ink" : "text-ink-3"}>{item.label}</span>
                <span className="sr-only">{done ? "hazır" : "eksik"}</span>
              </li>
            );
          })}
        </ul>

        <div className="mb-6 mt-6">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="font-medium text-ink-2">Hazırlık</span>
            <span className="tabular font-semibold text-ink">
              {doneCount}/{CHECKLIST_ITEMS.length} hazır
            </span>
          </div>
          <div
            className="meter"
            role="progressbar"
            aria-label="Plan hazırlığı"
            aria-valuemin={0}
            aria-valuemax={CHECKLIST_ITEMS.length}
            aria-valuenow={doneCount}
          >
            <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        </div>

        <Link href={href} className="btn btn-primary mt-auto w-full">
          Planı aç
          <ArrowRight />
        </Link>
      </div>
    </section>
  );
}

/** Öne çıkan kartın yükleme iskeleti. */
export function FeaturedTripSkeleton() {
  return (
    <div className="card grid overflow-hidden md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" aria-hidden="true">
      <div className="skeleton min-h-[15rem] rounded-none sm:min-h-[18rem] md:min-h-[21rem]" />
      <div className="space-y-4 p-6">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-6 w-1/2" />
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="skeleton h-5 w-2/3" />
        ))}
        <div className="skeleton h-2 w-full" />
        <div className="skeleton h-11 w-full rounded-full" />
      </div>
    </div>
  );
}
