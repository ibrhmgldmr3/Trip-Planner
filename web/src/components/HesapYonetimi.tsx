"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "react-hot-toast";
import { Alan, Dugme, GIRDI_SINIFI } from "@/components/ui";
import { logger } from "@/lib/logger";

/**
 * Hesap yaşam döngüsü arayüzü (B9): e-posta doğrulama ve hesap silme.
 *
 * Profil sayfasından ÇIKARILDI çünkü ikisi de kendi durumu, kendi hata
 * yolu ve kendi onay akışı olan işler; sayfanın içine gömülmeleri, zaten
 * 578 satır olan bir bileşeni daha da okunmaz yapardı.
 */

/* -------------------------------------------------------------------------- */
/* E-posta doğrulama                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Doğrulanmamış hesap için uyarı ve "yeniden gönder" düğmesi.
 *
 * DOĞRULANMIŞ HESAPTA HİÇBİR ŞEY GÖSTERMİYOR. "E-postanız doğrulanmış"
 * yeşil kutusu, kullanıcının hiçbir zaman ihtiyaç duymadığı bir bilgiyi
 * her ziyarette önüne koyardı.
 *
 * SOMUT KARŞILIK YAZILIYOR: "doğrulayın" demek yetmiyor, kullanıcı NEDEN
 * doğrulayacağını bilmeli — saatlik plan hakkı 1'den 5'e çıkıyor.
 */
export function EpostaDogrulama({ dogrulanmis }: { dogrulanmis: boolean }) {
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [gonderildi, setGonderildi] = useState(false);

  if (dogrulanmis) return null;

  const gonder = async () => {
    setGonderiliyor(true);

    try {
      const yanit = await fetch("/api/auth/verify-request", { method: "POST" });
      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        toast.error(govde?.error || "Doğrulama postası gönderilemedi");
        return;
      }

      setGonderildi(true);
      toast.success(govde?.message || "Doğrulama bağlantısı gönderildi");
    } catch (error) {
      logger.error("Doğrulama postası istenemedi", error);
      toast.error("Bir hata oluştu, lütfen tekrar deneyin");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-6">
      <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
        E-posta doğrulama
      </h3>

      <p className="text-sm text-[var(--fg-muted)] mt-2">
        Adresiniz henüz doğrulanmadı. Doğruladığınızda saatlik plan üretim
        hakkınız <strong className="text-[var(--fg)]">1&apos;den 5&apos;e</strong> çıkar.
      </p>

      <div className="mt-5">
        <Dugme
          tur="ikincil"
          className="w-full"
          bekliyor={gonderiliyor}
          onClick={gonder}
        >
          {gonderildi ? "Bağlantıyı tekrar gönder" : "Doğrulama bağlantısı gönder"}
        </Dugme>
      </div>

      {gonderildi && (
        <p className="text-sm text-[var(--fg-subtle)] mt-3">
          Bağlantı 24 saat geçerli. Gelen kutunuzu ve spam klasörünü kontrol edin.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hesap silme                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Hesabı ve bağlı tüm veriyi siler.
 *
 * ÜÇ SÜRTÜNME KATMANI, üçü de kasıtlı:
 *  1. Düğme doğrudan silmiyor, formu AÇIYOR.
 *  2. Form NE SİLİNECEĞİNİ tek tek yazıyor — "hesabınız silinecek" cümlesi,
 *     kullanıcının planlarının da gideceğini söylemiyor.
 *  3. Şifre (ya da Google hesaplarında e-posta adresi) elle yazılıyor.
 *
 * `confirm()` KULLANILMIYOR: tarayıcı diyaloğu ne silineceğini
 * biçimlendiremiyor, otomasyonda sessizce false dönüyor ve mobilde
 * kolayca kazara onaylanıyor.
 */
export function HesapSilme({
  eposta,
  sifreVar,
}: {
  eposta: string;
  sifreVar: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [onay, setOnay] = useState("");
  const [siliniyor, setSiliniyor] = useState(false);

  const sil = async () => {
    setSiliniyor(true);

    try {
      const yanit = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onay }),
      });

      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        toast.error(govde?.error || "Hesap silinemedi");
        return;
      }

      // Oturum HEMEN kapatılıyor: silinmiş bir kullanıcının JWT'si hâlâ
      // geçerli görünür ve sonraki her istek anlamsız 404'lere düşerdi.
      toast.success("Hesabınız silindi");
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      logger.error("Hesap silinemedi", error);
      toast.error("Bir hata oluştu, lütfen tekrar deneyin");
    } finally {
      setSiliniyor(false);
    }
  };

  if (!acik) {
    return (
      <div className="mt-3">
        <Dugme tur="tehlike" className="w-full" onClick={() => setAcik(true)}>
          Hesabı sil
        </Dugme>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[var(--radius)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-4">
      <p className="text-sm text-[var(--danger)] font-medium">
        Bu işlem geri alınamaz.
      </p>

      <ul className="text-sm text-[var(--fg-muted)] mt-2 space-y-1 list-disc list-inside">
        <li>Tüm seyahat planlarınız</li>
        <li>Bütçe kalemleriniz ve günlük planlarınız</li>
        <li>Konaklama ve ulaşım kayıtlarınız</li>
        <li>Hesabınız ve profil bilgileriniz</li>
      </ul>

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void sil();
        }}
      >
        <Alan
          etiket={sifreVar ? "Şifreniz" : "E-posta adresiniz"}
          htmlFor="hesap-silme-onay"
          ipucu={
            sifreVar
              ? "Onaylamak için hesap şifrenizi girin."
              : `Onaylamak için ${eposta} adresini yazın.`
          }
        >
          <input
            id="hesap-silme-onay"
            type={sifreVar ? "password" : "email"}
            autoComplete={sifreVar ? "current-password" : "off"}
            required
            value={onay}
            onChange={(e) => setOnay(e.target.value)}
            className={GIRDI_SINIFI}
            placeholder={sifreVar ? "••••••••" : eposta}
          />
        </Alan>

        <div className="flex gap-2">
          <Dugme
            tur="ikincil"
            className="flex-1"
            type="button"
            onClick={() => {
              setAcik(false);
              setOnay("");
            }}
          >
            Vazgeç
          </Dugme>
          <Dugme tur="tehlike" className="flex-1" type="submit" bekliyor={siliniyor}>
            Kalıcı olarak sil
          </Dugme>
        </div>
      </form>
    </div>
  );
}
