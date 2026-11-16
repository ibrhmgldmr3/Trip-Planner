"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Users, Wallet } from "lucide-react";
import CityCover from "./CityCover";
import StatusBadge from "./StatusBadge";
import PlanActions, { SourceTag } from "./dashboard/PlanActions";
import { formatDateRange, formatMoney, tripDays } from "@/lib/format";
import { effectiveStatus, type PlanSummary, type StoredStatus } from "@/lib/plan";

interface PlanCardProps {
  plan: PlanSummary;
  busy?: boolean;
  /** Verilmezse durum düğmeleri gösterilmez. */
  onStatus?: (status: StoredStatus) => void;
  onDelete: () => void;
  /** Gezi defteri görünümü: kaynak etiketi yerine kişi sayısı, "gezi" dili. */
  journal?: boolean;
}

/** Fotoğraflı plan kartı (Planlarım ızgarası ve gezi defteri). */
export default function PlanCard({ plan, busy = false, onStatus, onDelete, journal = false }: PlanCardProps) {
  const status = effectiveStatus(plan);
  const days = tripDays(plan.startDate, plan.endDate);
  const muted = status === "CANCELLED";
  const href = `/plan-detail/${plan.id}`;

  return (
    <article
      className={`card card-lift group flex h-full flex-col overflow-hidden ${
        muted ? "opacity-75" : ""
      }`}
    >
      {/* Görsel bağlantı; klavye ve ekran okuyucu için başlıktaki bağlantı yeterli. */}
      <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
        <CityCover
          city={plan.city}
          country={plan.country}
          className={`aspect-[4/3] ${muted ? "grayscale-[0.6]" : ""}`}
          imageClassName="zoom-img"
        >
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3.5">
            <StatusBadge status={status} onPhoto />
            {!journal && <SourceTag source={plan.source} />}
          </div>
        </CityCover>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-bold leading-tight text-ink">
          <Link href={href} className="break-words hover:text-brand">
            {plan.city}
          </Link>
        </h3>
        {plan.country && <p className="mt-0.5 text-sm text-ink-3">{plan.country}</p>}

        {(days > 0 || plan.totalCost !== null || journal) && (
          <p className="tabular mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink-2 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-ink-3">
            {days > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays />
                {days} gün
              </span>
            )}
            {journal && (
              <>
                {days > 0 && <span aria-hidden="true">·</span>}
                <span className="inline-flex items-center gap-1.5">
                  <Users />
                  {plan.travelers} kişi
                </span>
              </>
            )}
            {plan.totalCost !== null && (
              <>
                {(days > 0 || journal) && <span aria-hidden="true">·</span>}
                <span className="inline-flex items-center gap-1.5">
                  <Wallet />
                  {formatMoney(plan.totalCost, plan.currency)}
                </span>
              </>
            )}
          </p>
        )}
        <p className="tabular mt-1.5 text-sm text-ink-3">{formatDateRange(plan.startDate, plan.endDate)}</p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <PlanActions
            plan={plan}
            busy={busy}
            onStatus={onStatus}
            onDelete={onDelete}
            kind={journal ? "trip" : "plan"}
            className="-ml-2"
          />
          <Link
            href={href}
            className="btn btn-primary btn-icon h-10 w-10"
            aria-label={`${plan.city} ${journal ? "gezisinin" : "planının"} ayrıntılarını aç`}
            title="Planı aç"
          >
            <ArrowRight />
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Yüklenirken kart iskeleti. */
export function PlanCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-4 w-2/5" />
        <div className="flex justify-end pt-2">
          <div className="skeleton h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}
