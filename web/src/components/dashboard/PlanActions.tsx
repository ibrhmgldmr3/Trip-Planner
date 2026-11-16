"use client";

import { Ban, CircleCheck, PencilLine, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { canCancel, canMarkDone, canRestore, effectiveStatus, type PlanSummary, type StoredStatus } from "@/lib/plan";

interface PlanActionsProps {
  plan: PlanSummary;
  busy?: boolean;
  /** Verilmezse durum düğmeleri gösterilmez (ör. gezi defteri). */
  onStatus?: (status: StoredStatus) => void;
  onDelete: () => void;
  /** Erişilebilir etiketlerde "plan" mı "gezi" mi deneceği. */
  kind?: "plan" | "trip";
  className?: string;
}

const ICON_BTN = "btn btn-quiet btn-icon h-9 w-9";

/** Plan kartlarındaki küçük simge düğmeleri: gerçekleşti, iptal / geri al, sil. */
export default function PlanActions({
  plan,
  busy = false,
  onStatus,
  onDelete,
  kind = "plan",
  className = "",
}: PlanActionsProps) {
  const status = effectiveStatus(plan);
  const noun = kind === "trip" ? "gezisini" : "planını";

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {onStatus && canMarkDone(plan) && (
        <button
          type="button"
          className={`${ICON_BTN} hover:text-mint`}
          disabled={busy}
          onClick={() => onStatus("DONE")}
          aria-label={`${plan.city} planını gerçekleşti olarak işaretle`}
          title="Gerçekleşti olarak işaretle"
        >
          <CircleCheck />
        </button>
      )}
      {onStatus && canCancel(status) && (
        <button
          type="button"
          className={ICON_BTN}
          disabled={busy}
          onClick={() => onStatus("CANCELLED")}
          aria-label={`${plan.city} planını iptal et`}
          title="Planı iptal et"
        >
          <Ban />
        </button>
      )}
      {onStatus && canRestore(status) && (
        <button
          type="button"
          className={ICON_BTN}
          disabled={busy}
          onClick={() => onStatus("PLANNED")}
          aria-label={`${plan.city} planını geri al`}
          title="Planı geri al"
        >
          <RotateCcw />
        </button>
      )}
      <button
        type="button"
        className={`${ICON_BTN} hover:text-rose`}
        disabled={busy}
        onClick={onDelete}
        aria-label={`${plan.city} ${noun} sil`}
        title={kind === "trip" ? "Geziyi sil" : "Planı sil"}
      >
        <Trash2 />
      </button>
    </div>
  );
}

/** Fotoğraf üzerinde planın kaynağı: AI ya da manuel. */
export function SourceTag({ source }: { source: PlanSummary["source"] }) {
  const manual = source === "MANUAL";
  return (
    <span className="glass inline-flex h-[1.65rem] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold [&_svg]:h-3.5 [&_svg]:w-3.5">
      {manual ? <PencilLine /> : <Sparkles />}
      {manual ? "Manuel" : "AI"}
    </span>
  );
}
