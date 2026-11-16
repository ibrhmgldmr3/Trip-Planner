import { STATUS_LABEL, type PlanStatus } from "@/lib/plan";

interface StatusBadgeProps {
  status: PlanStatus;
  /** Fotoğraf üzerinde: beyaz zeminli, gölgeli. */
  onPhoto?: boolean;
  className?: string;
}

/** Plan durumunu renkli bir rozetle gösterir. */
export default function StatusBadge({ status, onPhoto = false, className = "" }: StatusBadgeProps) {
  return (
    <span className={`status ${onPhoto ? "status-on-photo" : ""} ${className}`} data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}
