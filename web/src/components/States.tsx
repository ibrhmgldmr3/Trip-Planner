import type { ReactNode } from "react";

/** Noktalı rota üzerinde ilerleyen yükleme göstergesi. */
export function RouteLoader({ className = "h-16 w-40" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 64" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 50C40 50 36 16 64 16s28 32 52 32 20-18 34-22"
        stroke="var(--brand)"
        strokeWidth="2.5"
        className="route-dash-flow"
      />
      <circle cx="12" cy="50" r="4.5" fill="var(--brand)" />
      <circle cx="150" cy="26" r="5.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

export function PageLoader({ label = "Yükleniyor…" }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5" role="status" aria-live="polite">
      <div className="text-center">
        <RouteLoader className="mx-auto h-16 w-40" />
        <p className="mt-3 text-sm font-medium text-ink-2">{label}</p>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

/** Boş liste, hata veya yetki ekranları için ortak gövde. */
export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="card glow mx-auto max-w-xl overflow-hidden px-6 py-14 text-center">
      {icon && (
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand [&_svg]:h-6 [&_svg]:w-6">
          {icon}
        </div>
      )}
      <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-2">{description}</p>}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">{children}</div>}
    </div>
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="rise">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[1.9rem] font-extrabold leading-tight text-ink md:text-[2.3rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[0.98rem] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="rise flex flex-wrap items-center gap-2.5" style={{ "--i": 1 } as React.CSSProperties}>{actions}</div>}
    </div>
  );
}

/** Sayfa gövdesi: ortak genişlik ve iç boşluk. */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12 ${className}`}>{children}</main>;
}
