"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BagDugme, Yukleniyor } from "@/components/ui";
import { HesapBildirimi, HesapKabugu } from "@/components/HesapKabugu";
import { logger } from "@/lib/logger";

/**
 * E-posta doğrulama bağlantısının indiği sayfa (B9).
 *
 * NEDEN GET DEĞİL POST: doğrulama bir YAZMA işlemi. E-posta istemcileri ve
 * kurumsal bağlantı tarayıcıları postadaki adresleri kullanıcı adına ÖN
 * YÜKLÜYOR; doğrulamayı GET'e bağlamak, jetonun kullanıcı bağlantıya
 * tıklamadan tüketilmesi demekti. Sayfa açılıyor, isteği tarayıcı
 * gönderiyor.
 *
 * `useRef` NÖBETİ: React 18 katı modda efektleri iki kez çalıştırıyor.
 * Jeton tek kullanımlık olduğu için ikinci çağrı daima "geçersiz bağlantı"
 * derdi — yani doğru çalışan akış kullanıcıya HATA olarak görünürdü.
 */
function DogrulamaAkisi() {
  const jeton = useSearchParams().get("token") ?? "";
  const [durum, setDurum] = useState<"bekliyor" | "basarili" | "hatali">("bekliyor");
  const [mesaj, setMesaj] = useState("");
  const gonderildi = useRef(false);

  const dogrula = useCallback(async () => {
    try {
      const yanit = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: jeton }),
      });

      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        setDurum("hatali");
        setMesaj(govde?.error || "Doğrulama tamamlanamadı");
        return;
      }

      setDurum("basarili");
      setMesaj(govde?.message || "E-posta adresiniz doğrulandı.");
    } catch (err) {
      logger.error("E-posta doğrulanamadı", err);
      setDurum("hatali");
      setMesaj("Bir hata oluştu. Lütfen tekrar deneyin.");
    }
  }, [jeton]);

  useEffect(() => {
    if (!jeton) {
      setDurum("hatali");
      setMesaj("Doğrulama bağlantısı eksik ya da bozuk görünüyor.");
      return;
    }

    if (gonderildi.current) return;
    gonderildi.current = true;

    void dogrula();
  }, [jeton, dogrula]);

  return (
    <HesapKabugu
      baslik="E-posta doğrulama"
      aciklama={
        durum === "bekliyor"
          ? "Bağlantınız kontrol ediliyor…"
          : durum === "basarili"
          ? "Hesabınız artık doğrulanmış."
          : "Bağlantı kullanılamadı."
      }
      altBilgi={
        <Link
          href="/profile"
          className="text-[var(--accent)] font-medium hover:underline underline-offset-4"
        >
          Profilinize dönün
        </Link>
      }
    >
      {durum === "bekliyor" && <Yukleniyor metin="Doğrulanıyor…" />}

      {durum === "basarili" && (
        <>
          <HesapBildirimi ton="basari">{mesaj}</HesapBildirimi>
          <p className="text-sm text-[var(--fg-muted)] mb-5">
            Saatlik plan üretim hakkınız artık 5.
          </p>
          <BagDugme href="/ai-planner" boy="lg" className="w-full">
            Plan oluşturmaya başlayın
          </BagDugme>
        </>
      )}

      {durum === "hatali" && (
        <>
          <HesapBildirimi ton="hata">{mesaj}</HesapBildirimi>
          <p className="text-sm text-[var(--fg-muted)]">
            Bağlantı 24 saat geçerli ve yalnızca bir kez kullanılabilir.
            Profil sayfanızdan yeni bir bağlantı isteyebilirsiniz.
          </p>
        </>
      )}
    </HesapKabugu>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Yukleniyor />}>
      <DogrulamaAkisi />
    </Suspense>
  );
}
