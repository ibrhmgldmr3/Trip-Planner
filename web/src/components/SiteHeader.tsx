"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { BookOpen, ChevronDown, LogOut, Luggage, Menu, Plus, Settings, Wallet, X } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { initials } from "@/lib/format";

const NAV = [
  { href: "/explore", label: "Keşfet", match: ["/explore"] },
  { href: "/travel-mode", label: "Plan oluştur", match: ["/travel-mode", "/ai-planner", "/manual-planner"] },
  { href: "/my-plans", label: "Planlarım", match: ["/my-plans", "/plan-detail", "/my-trips", "/budget"] },
];

const isActive = (pathname: string, match: string[]) =>
  match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/** Üst kenarı tam ekran fotoğrafla başlayan sayfalar: başlık fotoğrafın üzerine biner. */
const HERO_ROUTES = ["/"];

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sayfa değişince açık menüleri kapat.
  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!userRef.current?.contains(event.target as Node)) setUserOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [userOpen]);

  const authed = status === "authenticated";
  const name = session?.user?.name || "Gezgin";
  // Fotoğrafın üzerindeyken şeffaf ve beyaz yazılı; kaydırınca ya da menü açılınca düz zemine döner.
  const overlay = HERO_ROUTES.includes(pathname) && !scrolled && !menuOpen;

  return (
    <header
      data-overlay={overlay}
      className={`no-print sticky top-0 z-40 transition-[background-color,border-color,box-shadow,color] duration-300 ${
        overlay
          ? "border-b border-transparent bg-transparent text-white"
          : "border-b border-line bg-canvas/85 text-ink shadow-soft backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 md:px-8">
        <Logo onDark={overlay} />

        <nav className="hidden flex-1 md:block" aria-label="Ana menü">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.match);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-3.5 py-2 text-[0.92rem] font-semibold transition-colors ${
                      overlay
                        ? "text-white/85 hover:bg-white/15 hover:text-white"
                        : active
                          ? "bg-brand-soft text-brand"
                          : "text-ink-2 hover:bg-canvas-2 hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <span className={overlay ? "[&_.btn]:text-white [&_.btn:hover]:bg-white/15 [&_.btn:hover]:text-white" : ""}>
            <ThemeToggle />
          </span>

          {authed ? (
            <div className="relative hidden md:block" ref={userRef}>
              <button
                type="button"
                onClick={() => setUserOpen((open) => !open)}
                className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm font-semibold transition-colors ${
                  overlay ? "bg-white/15 text-white hover:bg-white/25" : "bg-surface text-ink shadow-soft hover:text-brand"
                }`}
                aria-haspopup="menu"
                aria-expanded={userOpen}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand to-lav text-xs font-bold text-white">
                  {initials(session?.user?.name)}
                </span>
                <span className="max-w-[9rem] truncate">{name}</span>
                <ChevronDown className={`h-4 w-4 opacity-70 transition-transform ${userOpen ? "rotate-180" : ""}`} />
              </button>

              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-lift"
                >
                  <div className="px-3 pb-2 pt-2">
                    <p className="truncate text-sm font-semibold text-ink">{name}</p>
                    <p className="truncate text-xs text-ink-3">{session?.user?.email}</p>
                  </div>
                  <hr className="dash-rule mx-2 mb-1.5" />
                  <MenuLink href="/my-plans" icon={<Luggage />} label="Planlarım" />
                  <MenuLink href="/my-trips" icon={<BookOpen />} label="Gezi defteri" />
                  <MenuLink href="/budget" icon={<Wallet />} label="Bütçe" />
                  <MenuLink href="/profile" icon={<Settings />} label="Profil ve tercihler" />
                  <hr className="dash-rule mx-2 my-1.5" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose transition-colors hover:bg-rose-soft [&_svg]:h-4 [&_svg]:w-4"
                  >
                    <LogOut />
                    Çıkış yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            status !== "loading" && (
              <Link
                href="/login"
                className={`btn btn-sm hidden md:inline-flex ${overlay ? "btn-glass" : "btn-outline"}`}
              >
                Giriş yap
              </Link>
            )
          )}

          <Link
            href="/travel-mode"
            className={`btn btn-sm hidden sm:inline-flex ${overlay ? "btn-white" : "btn-primary"}`}
          >
            <Plus />
            Yeni plan
          </Link>

          <button
            type="button"
            className={`btn btn-icon md:hidden ${overlay ? "btn-glass" : "btn-quiet"}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-line md:hidden">
          <nav className="mx-auto max-w-7xl px-5 pb-5 pt-3" aria-label="Mobil menü">
            <ul className="space-y-1">
              {NAV.map((item) => {
                const active = isActive(pathname, item.match);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-xl px-3 py-3 text-base font-semibold ${
                        active ? "bg-brand-soft text-brand" : "text-ink-2"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <hr className="dash-rule my-3" />

            {authed ? (
              <div className="space-y-2">
                <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-lav text-xs font-bold text-white">
                    {initials(session?.user?.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                    <span className="block truncate text-xs text-ink-3">Profil ve tercihler</span>
                  </span>
                </Link>
                <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="btn btn-danger w-full">
                  <LogOut />
                  Çıkış yap
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" className="btn btn-outline">
                  Giriş yap
                </Link>
                <Link href="/register" className="btn btn-primary">
                  Kayıt ol
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-brand-soft hover:text-brand [&_svg]:h-4 [&_svg]:w-4"
    >
      {icon}
      {label}
    </Link>
  );
}
