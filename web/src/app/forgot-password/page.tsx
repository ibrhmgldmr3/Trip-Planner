"use client";

import { useState } from "react";
import Link from "next/link";
import { Alan, Dugme, GIRDI_SINIFI } from "@/components/ui";
import { HesapBildirimi, HesapKabugu } from "@/components/HesapKabugu";
import { logger } from "@/lib/logger";

/**
 * Şifre sıfırlama isteği (B9).
 *
 * SONUÇ EKRANI HESAP VARLIĞINI SIZDIRMIYOR. Uç, adres kayıtlı olsun ya da
 * olmasın aynı yanıtı veriyor; bu ekran da onu olduğu gibi gösteriyor.
 * "Böyle bir kullanıcı yok" demek, formu bir üyelik sorgulayıcısına
 * çevirirdi.
 *
 * FORM BAŞARIDAN SONRA GİZLENİYOR: aynı ekranda hem "postayı gönderdik"
 * yazıp hem doldurulmuş bir form bırakmak, kullanıcıyı tekrar göndermeye
 * davet ediyor ve saatlik hakkını tüketiyordu.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [hata, setHata] = useState("");
  const [sonuc, setSonuc] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setYukleniyor(true);
    setHata("");

    try {
      const yanit = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        setHata(govde?.error || "İstek gönderilemedi");
        return;
      }

      setSonuc(govde?.message || "Bağlantı gönderildi.");
    } catch (err) {
      logger.error("Şifre sıfırlama isteği gönderilemedi", err);
      setHata("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <HesapKabugu
      baslik="Şifrenizi mi unuttunuz?"
      aciklama="E-posta adresinizi girin, sıfırlama bağlantısı gönderelim."
      altBilgi={
        <>
          Şifrenizi hatırladınız mı?{" "}
          <Link
            href="/login"
            className="text-[var(--accent)] font-medium hover:underline underline-offset-4"
          >
            Giriş yapın
          </Link>
        </>
      }
    >
      {hata && <HesapBildirimi ton="hata">{hata}</HesapBildirimi>}

      {sonuc ? (
        <>
          <HesapBildirimi ton="basari">{sonuc}</HesapBildirimi>
          <p className="text-sm text-[var(--fg-muted)]">
            Bağlantı 1 saat geçerli ve yalnızca bir kez kullanılabilir.
          </p>
        </>
      ) : (
        <form onSubmit={gonder} className="space-y-5">
          <Alan etiket="E-posta" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={GIRDI_SINIFI}
              placeholder="ornek@eposta.com"
            />
          </Alan>

          <Dugme type="submit" boy="lg" bekliyor={yukleniyor} className="w-full">
            Sıfırlama bağlantısı gönder
          </Dugme>
        </form>
      )}
    </HesapKabugu>
  );
}
