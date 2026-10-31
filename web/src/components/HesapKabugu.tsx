"use client";

import type { ReactNode } from "react";
import { KonturDoku, Pusula } from "@/components/ui";

/**
 * Oturum dışı hesap ekranlarının ortak kabuğu (B9).
 *
 * NEDEN ÇIKARILDI: şifre sıfırlama, yeni şifre ve e-posta doğrulama
 * ekranlarının üçü de giriş sayfasıyla aynı yüzeyde durmak zorunda —
 * kullanıcı bu akışların ortasında "başka bir siteye mi düştüm"
 * sormamalı. Aynı 40 satırı üç kez kopyalamak, birinin zamanla ayrışması
 * demekti.
 */
export function HesapKabugu({
  baslik,
  aciklama,
  children,
  altBilgi,
}: {
  baslik: string;
  aciklama: string;
  children: ReactNode;
  altBilgi?: ReactNode;
}) {
  return (
    <div className="harita-zemin relative min-h-screen px-4 py-12 md:py-20 flex items-start justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <KonturDoku yogunluk={0.7} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Pusula className="h-9 w-9 mx-auto text-[var(--accent)]" />
          <h1 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--fg)] mt-4">
            {baslik}
          </h1>
          <p className="text-[var(--fg-muted)] mt-2">{aciklama}</p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-[var(--shadow-pop)]">
          <div className="p-6 md:p-7">{children}</div>
        </div>

        {altBilgi && (
          <p className="text-sm text-[var(--fg-muted)] text-center mt-6">{altBilgi}</p>
        )}
      </div>
    </div>
  );
}

/** Akış sonucunu bildiren şerit; hata ve başarı aynı yerde duruyor. */
export function HesapBildirimi({
  ton,
  children,
}: {
  ton: "hata" | "basari";
  children: ReactNode;
}) {
  const hata = ton === "hata";

  return (
    <p
      role={hata ? "alert" : "status"}
      className={
        "mb-5 rounded-[var(--radius)] border px-4 py-3 text-sm " +
        (hata
          ? "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]"
          : "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]")
      }
    >
      {children}
    </p>
  );
}
