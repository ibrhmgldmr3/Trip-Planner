"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BagDugme, cx } from "./ui";

export default function UserNav() {
  const { data: session, status } = useSession();
  const [acik, setAcik] = useState(false);
  const sarmalayiciRef = useRef<HTMLDivElement>(null);

  /**
   * Menü dışına tıklayınca ve Escape'e basınca kapanır.
   *
   * Eskiden yalnızca bir menü ögesine tıklayınca kapanıyordu: kullanıcı
   * boşluğa tıkladığında menü açık kalıyor ve sayfanın üstünü kapatıyordu.
   */
  useEffect(() => {
    if (!acik) return;

    const disariTikla = (olay: MouseEvent) => {
      if (!sarmalayiciRef.current?.contains(olay.target as Node)) setAcik(false);
    };
    const escBas = (olay: KeyboardEvent) => {
      if (olay.key === "Escape") setAcik(false);
    };

    document.addEventListener("mousedown", disariTikla);
    document.addEventListener("keydown", escBas);
    return () => {
      document.removeEventListener("mousedown", disariTikla);
      document.removeEventListener("keydown", escBas);
    };
  }, [acik]);

  const menuOgesi =
    "block px-4 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors";

  return (
    <div className="relative" ref={sarmalayiciRef}>
      {status === "authenticated" ? (
        <>
          <button
            type="button"
            onClick={() => setAcik((a) => !a)}
            className={cx(
              "flex items-center gap-2 rounded-[var(--radius)] pl-1 pr-2 py-1 transition-colors",
              "hover:bg-[var(--surface-2)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            )}
            aria-expanded={acik}
            aria-haspopup="true"
          >
            <span className="w-7 h-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center text-sm font-semibold">
              {session.user?.name ? session.user.name.charAt(0).toLocaleUpperCase("tr") : "K"}
            </span>
            <span className="hidden md:inline text-sm text-[var(--fg)] max-w-[10rem] truncate">
              {session.user?.name || "Kullanıcı"}
            </span>
          </button>

          {acik && (
            <div className="absolute right-0 mt-2 w-52 py-1 z-20 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-pop)]">
              <Link href="/profile" className={menuOgesi} onClick={() => setAcik(false)}>
                Profilim
              </Link>
              <Link href="/profile/my-trips" className={menuOgesi} onClick={() => setAcik(false)}>
                Seyahatlerim
              </Link>
              <Link href="/my-plans" className={menuOgesi} onClick={() => setAcik(false)}>
                Planlarım
              </Link>
              <div className="my-1 border-t border-[var(--line)]" />
              <button
                type="button"
                onClick={() => {
                  setAcik(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="w-full text-left px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
              >
                Çıkış yap
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <BagDugme href="/login" tur="sessiz" boy="sm">
            Giriş yap
          </BagDugme>
          <BagDugme href="/register" tur="ikincil" boy="sm">
            Kayıt ol
          </BagDugme>
        </div>
      )}
    </div>
  );
}

