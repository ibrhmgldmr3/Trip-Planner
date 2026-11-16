"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Luggage, Settings, Sparkles, Wallet } from "lucide-react";

const ITEMS = [
  { href: "/my-plans", label: "Planlarım", icon: <Luggage /> },
  { href: "/my-trips", label: "Gezi defteri", icon: <BookOpen /> },
  { href: "/explore", label: "Keşfet", icon: <Compass /> },
  { href: "/budget", label: "Bütçe", icon: <Wallet /> },
  { href: "/profile", label: "Ayarlar", icon: <Settings /> },
];

/** Hesap sayfalarının yan menüsü. Dar ekranda yatay kaydırılan sekmelere dönüşür. */
export default function PanelSidebar() {
  const pathname = usePathname() ?? "";
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="no-print min-w-0 lg:sticky lg:top-24 lg:self-start">
      <nav aria-label="Hesap menüsü">
        <ul className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
          {ITEMS.map((item) => (
            <li key={item.href} className="flex-none">
              <Link
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[0.95rem] font-semibold transition-colors lg:py-3 [&_svg]:h-[1.15rem] [&_svg]:w-[1.15rem] ${
                  active(item.href)
                    ? "bg-brand-soft text-brand"
                    : "text-ink-2 hover:bg-surface hover:text-ink hover:shadow-soft"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="glow mt-8 hidden overflow-hidden rounded-[1.25rem] border border-line bg-surface p-5 text-center lg:block">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand [&_svg]:h-5 [&_svg]:w-5">
          <Sparkles />
        </span>
        <p className="mt-3 font-display text-base font-bold text-ink">AI ile planla</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">Şehri yaz, gün gün planın ve haritan hazırlansın.</p>
        <Link href="/ai-planner" className="btn btn-primary btn-sm mt-4 w-full">
          Hemen dene
        </Link>
      </div>
    </aside>
  );
}
