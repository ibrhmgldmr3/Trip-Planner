"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alan, Dugme, GIRDI_SINIFI, Yukleniyor } from "@/components/ui";
import { HesapBildirimi, HesapKabugu } from "@/components/HesapKabugu";
import { logger } from "@/lib/logger";

/**
 * Yeni şifre belirleme (B9).
 *
 * JETON YALNIZCA URL'DE, HİÇBİR YERE KOPYALANMIYOR — ne state'e kalıcı
 * olarak, ne localStorage'a. Tek kullanımlık ve 1 saatlik; saklamanın
 * getirisi yok, sızma yüzeyi ise var.
 *
 * İKİNCİ ŞİFRE ALANI VAR: sıfırlama, kullanıcının şifresini bir daha
 * göremeyeceği tek an. Bir harf hatası, akışı baştan başlatmak demek.
 */
function SifirlamaFormu() {
  const router = useRouter();
  const jeton = useSearchParams().get("token") ?? "";

  const [sifre, setSifre] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [hata, setHata] = useState("");
  const [sonuc, setSonuc] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata("");

    // İki alanı SUNUCUYA GİTMEDEN karşılaştırıyoruz: eşleşmeyen bir çift
    // için jetonu harcamak, kullanıcıyı yeni bağlantı istemeye zorlardı.
    if (sifre !== tekrar) {
      setHata("Şifreler eşleşmiyor");
      return;
    }

    setYukleniyor(true);

    try {
      const yanit = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: jeton, password: sifre }),
      });

      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        setHata(govde?.error || "Şifre güncellenemedi");
        return;
      }

      setSonuc(govde?.message || "Şifreniz güncellendi.");

      // Kullanıcıyı girişe götürüyoruz ama HEMEN DEĞİL: başarı mesajını
      // okumadan yönlendirmek, "oldu mu olmadı mı" sorusu bırakıyordu.
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      logger.error("Şifre güncellenemedi", err);
      setHata("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setYukleniyor(false);
    }
  };

  // Jetonsuz gelinmişse form GÖSTERİLMİYOR: doldurulup gönderildiğinde
  // nasılsa reddedilecek bir formu sunmak, kullanıcının vaktini alıyor.
  if (!jeton) {
    return (
      <HesapKabugu
        baslik="Bağlantı geçersiz"
        aciklama="Sıfırlama bağlantısı eksik ya da bozuk görünüyor."
        altBilgi={
          <Link
            href="/forgot-password"
            className="text-[var(--accent)] font-medium hover:underline underline-offset-4"
          >
            Yeni bağlantı isteyin
          </Link>
        }
      >
        <HesapBildirimi ton="hata">
          Bağlantıyı e-postadaki hâliyle açtığınızdan emin olun.
        </HesapBildirimi>
      </HesapKabugu>
    );
  }

  return (
    <HesapKabugu
      baslik="Yeni şifre belirleyin"
      aciklama="En az 8 karakter, bir harf ve bir rakam içermeli."
      altBilgi={
        <Link
          href="/login"
          className="text-[var(--accent)] font-medium hover:underline underline-offset-4"
        >
          Giriş sayfasına dön
        </Link>
      }
    >
      {hata && <HesapBildirimi ton="hata">{hata}</HesapBildirimi>}

      {sonuc ? (
        <HesapBildirimi ton="basari">
          {sonuc} Giriş sayfasına yönlendiriliyorsunuz…
        </HesapBildirimi>
      ) : (
        <form onSubmit={gonder} className="space-y-5">
          <Alan etiket="Yeni şifre" htmlFor="password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className={GIRDI_SINIFI}
              placeholder="••••••••"
            />
          </Alan>

          <Alan etiket="Yeni şifre (tekrar)" htmlFor="passwordRepeat">
            <input
              id="passwordRepeat"
              name="passwordRepeat"
              type="password"
              autoComplete="new-password"
              required
              value={tekrar}
              onChange={(e) => setTekrar(e.target.value)}
              className={GIRDI_SINIFI}
              placeholder="••••••••"
            />
          </Alan>

          <Dugme type="submit" boy="lg" bekliyor={yukleniyor} className="w-full">
            Şifreyi güncelle
          </Dugme>
        </form>
      )}
    </HesapKabugu>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Yukleniyor />}>
      <SifirlamaFormu />
    </Suspense>
  );
}
