import Link from "next/link";
import { Plus } from "lucide-react";

/** Izgaranın sonundaki kesik çerçeveli "yeni plan" kartı. */
export default function NewPlanCard({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/travel-mode"
      className={`group flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-[1.25rem] border-2 border-dashed border-line-2 p-6 text-center transition-colors hover:border-brand hover:bg-brand-soft/50 ${className}`}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-brand shadow-soft transition-transform group-hover:scale-105 [&_svg]:h-5 [&_svg]:w-5">
        <Plus />
      </span>
      <span>
        <span className="block font-display text-base font-bold text-brand">Yeni bir plan oluştur</span>
        <span className="mt-0.5 block text-sm text-ink-2">Sıradaki durak neresi?</span>
      </span>
    </Link>
  );
}
