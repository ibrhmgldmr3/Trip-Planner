"use client";

import { useMemo } from "react";
import { butceyiCoz, REZERV_ORANI } from "@/lib/plan-budget";

/**
 * Plan bütçesinin okunur dökümü.
 *
 * NEDEN AYRI DOSYA VE NEDEN BİLEŞEN:
 *
 * Bu blok `plan-detail/[id]/page.tsx` içinde bir HTML STRING üreticisiydi —
 * `butce_tahmini` sütununu KENDİ `JSON.parse`ı ve kendi toplama mantığıyla
 * okuyup `dangerouslySetInnerHTML`e veriyordu. `src/lib/plan-budget.ts` tam
 * olarak bunu bitirmek için yazılmıştı (docblock'unda dört ayrı
 * ayrıştırıcının birbirini tutmadığını anlatıyor) ama bu ekran dördüncüsü
 * olarak geride kalmıştı. Üç somut sonucu vardı:
 *
 *  1. Toplam alanı boş bir satırda ekranda `extraItemsTotal` — bir toplam
 *     DEĞİL, kategori dışı kalemlerin tutarı — "Toplam" diye görünüyordu.
 *  2. Kalemlerin `source` alanı hiç okunmuyordu: agentic üretimde bir arama
 *     sonucuna dayanan tutarların kaynağı kullanıcıya gösterilmiyordu.
 *  3. `guvenliKaynakUrl` şema denetimi devrede değildi; bu blokta bir gün
 *     bağlantı basılsaydı `javascript:` yüzeyi geri açılırdı.
 *
 * Artık tek ayrıştırıcı `butceyiCoz` ve metin React tarafından kaçırılıyor;
 * string birleştirme yok. Sayfadan ayrı bir dosyada olmasının sebebi
 * testlenebilirlik: `page.tsx` yalnızca varsayılan dışa aktarımına izin
 * veriyor, bileşen oradan import edilemiyordu.
 */

/** "₺12.500" — tutarlar her yerde aynı biçimde. */
export function tl(tutar: number): string {
  return `₺${Math.round(tutar).toLocaleString("tr-TR")}`;
}

export interface ButceDokumuProps {
  /** `TripPlan.butce_tahmini` sütununun ham içeriği. */
  raw: string;
  /**
   * Eski (markdown) satırlar için hazır, SANITIZE EDİLMİŞ yedek HTML.
   *
   * `butceyiCoz` yalnızca bilinen JSON şeklini tanıyor; markdown biçimli
   * eski planlarda `null` dönüyor ve o satırlarda bütçe metnini
   * kaybetmemek gerekiyor. Sanitize etme sorumluluğu ÇAĞIRANDA: bu bileşen
   * kendisine verilen HTML'e güveniyor.
   */
  yedekHtml?: string | null;
}

export function ButceDokumu({ raw, yedekHtml }: ButceDokumuProps) {
  const butce = useMemo(() => butceyiCoz(raw), [raw]);

  if (!butce) {
    return (
      <div
        className="plan-govde"
        dangerouslySetInnerHTML={{ __html: yedekHtml ?? "" }}
      />
    );
  }

  const kategoriler = Object.entries(butce.categories);

  // Kaydedilmiş toplam yoksa kategorilerden türet; `extraItemsTotal`e
  // DÜŞÜLMEZ (bkz. plan-budget.ts'teki alan notu).
  const toplam =
    butce.totalCostWithExtras ||
    kategoriler.reduce((sum, [, kategori]) => sum + kategori.total, 0);

  // Katsayı tek yerde: plan-budget.ts.
  const onerilen = butce.suggestedBudget || Math.round(toplam * REZERV_ORANI);

  return (
    <div className="plan-govde">
      <div className="butce-ozet">
        <div className="butce-kutu">
          <div className="butce-etiket">Toplam</div>
          <div className="butce-deger butce-deger-aksan">{tl(toplam)}</div>
        </div>
        {onerilen > 0 && (
          <div className="butce-kutu">
            <div className="butce-etiket">Önerilen bütçe</div>
            <div className="butce-deger">{tl(onerilen)}</div>
          </div>
        )}
      </div>

      {kategoriler.map(([ad, kategori]) => (
        <div key={ad} className="butce-kategori">
          <div className="butce-kategori-basi">
            <div className="butce-kategori-ad">{ad}</div>
            <div className="butce-kategori-toplam">{tl(kategori.total)}</div>
          </div>

          {kategori.items.map((kalem, index) => (
            <div key={`${ad}-${index}`} className="butce-kalem">
              <div className="butce-kalem-ad">
                {kalem.description}
                {kalem.source && (
                  <a
                    className="butce-kalem-kaynak"
                    href={kalem.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    // Tutarın modelin kendi tahmini mi yoksa bir arama
                    // sonucu mu olduğu kullanıcı için anlamlı bir fark.
                    title="Bu tutarın dayandığı kaynak"
                  >
                    kaynak
                  </a>
                )}
              </div>
              <div className="butce-kalem-tutar">{tl(kalem.amount)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
