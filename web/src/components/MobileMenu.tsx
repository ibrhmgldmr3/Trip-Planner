"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import UserNav from "./UserNav";
import ThemeToggle from "./ThemeToggle";
import { useSession } from "next-auth/react";
import { BagDugme, Pusula, cx } from "./ui";

/**
 * Üst gezinme çubuğu.
 *
 * Bağlantılar TEK dizide (masaüstü + mobil aynı kaynaktan). Aktif sayfa
 * `usePathname` ile işaretleniyor; mobil menü Escape'e ve rota değişimine
 * kapanıyor.
 *
 * AKTİF DURUM NEDEN BÖYLE: "bulunduğunuz yer" bir harita fikri. Aktif
 * bağlantının altında macenta bir işaret var — yumuşak dolgu bir hap
 * yerine, haritadaki iğnenin karşılığı. Renk burada dekor değil: rota
 * rengi sayfa boyunca "buradasınız / buraya gidiyorsunuz" demek.
 */

const BAGLANTILAR = [
  { href: "/map", etiket: "Harita" },
  { href: "/daily-planner", etiket: "Planlayıcı" },
  { href: "/budget", etiket: "Bütçe" },
  { href: "/my-plans", etiket: "Planlarım" },
] as const;

export default function MobileMenu() {
  const [menuAcik, setMenuAcik] = useState(false);
  const [kaydirildi, setKaydirildi] = useState(false);
  const { data: session } = useSession();
  const yol = usePathname();

  useEffect(() => {
    const kaydirmaDinle = () => setKaydirildi(window.scrollY > 8);
    kaydirmaDinle();
    window.addEventListener("scroll", kaydirmaDinle, { passive: true });
    return () => window.removeEventListener("scroll", kaydirmaDinle);
  }, []);

  // Rota değişince menü açık kalmamalı; Next.js istemci tarafı geçişte
  // bileşeni yeniden bağlamıyor, bu yüzden açıkça kapatıyoruz.
  useEffect(() => {
    setMenuAcik(false);
  }, [yol]);

  useEffect(() => {
    if (!menuAcik) return;
    const escDinle = (olay: KeyboardEvent) => {
      if (olay.key === "Escape") setMenuAcik(false);
    };
    document.addEventListener("keydown", escDinle);
    return () => document.removeEventListener("keydown", escDinle);
  }, [menuAcik]);

  /** Aktif bölüm: alt yollar da (örn. /profile/my-trips) sayılıyor. */
  const aktifMi = (href: string) => yol === href || yol.startsWith(`${href}/`);

  return (
    <header
      className={cx(
        "sticky top-0 z-50 backdrop-blur-md transition-colors duration-200",
        kaydirildi
          ? "bg-[var(--bg)]/88 border-b border-[var(--line)]"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            // py-2.5: dokunma hedefi 36px'ten 48px'e çıkıyor (mobilde 44px
            // altı hedefler ıskalanıyor); görsel yükseklik değişmiyor.
            className="group flex items-center gap-2.5 rounded-[var(--radius)] py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Pusula className="h-7 w-7 text-[var(--accent)] transition-transform duration-500 group-hover:rotate-45" />
            <span className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
              Trip Planner
            </span>
          </Link>

          <nav className="hidden md:block" aria-label="Ana gezinme">
            <ul className="flex items-center gap-1">
              {BAGLANTILAR.map((bag) => (
                <li key={bag.href}>
                  <Link
                    href={bag.href}
                    aria-current={aktifMi(bag.href) ? "page" : undefined}
                    className={cx(
                      "relative block px-3 py-2 text-sm font-medium rounded-[var(--radius)]",
                      "transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                      aktifMi(bag.href)
                        ? "text-[var(--fg)]"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"
                    )}
                  >
                    {bag.etiket}
                    {aktifMi(bag.href) && (
                      <span
                        className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-[var(--route)]"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <BagDugme href="/travel-mode" boy="sm">
              Yeni plan
            </BagDugme>
            <UserNav />
          </div>

          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              className="p-2.5 rounded-[var(--radius)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              onClick={() => setMenuAcik((a) => !a)}
              aria-label={menuAcik ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={menuAcik}
              aria-controls="mobil-menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d={menuAcik ? "M6 18L18 6M6 6l12 12" : "M4 7h16M4 12h16M4 17h16"}
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {menuAcik && (
        <div
          id="mobil-menu"
          className="md:hidden border-t border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-pop)]"
        >
          <div className="px-4 py-4">
            <ul className="space-y-0.5">
              {BAGLANTILAR.map((bag) => (
                <li key={bag.href}>
                  <Link
                    href={bag.href}
                    aria-current={aktifMi(bag.href) ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-3 px-3 py-3 rounded-[var(--radius)] font-medium transition-colors",
                      aktifMi(bag.href)
                        ? "text-[var(--fg)] bg-[var(--surface-2)]"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"
                    )}
                  >
                    <span
                      className={cx(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        aktifMi(bag.href) ? "bg-[var(--route)]" : "bg-[var(--line-strong)]"
                      )}
                      aria-hidden="true"
                    />
                    {bag.etiket}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="pt-4 mt-3 border-t border-[var(--line)] space-y-2">
              <BagDugme href="/travel-mode" className="w-full">
                Yeni plan oluştur
              </BagDugme>

              {!session ? (
                <div className="grid grid-cols-2 gap-2">
                  <BagDugme href="/login" tur="ikincil">
                    Giriş
                  </BagDugme>
                  <BagDugme href="/register" tur="ikincil">
                    Kayıt
                  </BagDugme>
                </div>
              ) : (
                <BagDugme href="/profile" tur="ikincil" className="w-full">
                  Profil
                </BagDugme>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
