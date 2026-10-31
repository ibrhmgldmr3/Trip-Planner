"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { logger } from "@/lib/logger";
import { Dugme, Olcum, Rozet, Serit } from "@/components/ui";

/**
 * Planları ilişkisel modele taşıma akışı (B4 · 1. adım).
 *
 * NEDEN ARAYÜZE GEREK VAR: `POST /api/my-plans/migrate` ve kuru çalışma
 * raporu (`GET`) yazılmış, testlenmiş ve çalışır durumda — ama hiçbir
 * ekranda tetikleyicisi yoktu. Yani taşıma yalnızca elle `curl` atan biri
 * için vardı. İlişkisel modele geçen her ekran (bütçe, günlük plan,
 * konaklama, ulaşım) taşınmış veriye ihtiyaç duyduğu için bu, B4'ün geri
 * kalanını kilitleyen adımdı.
 *
 * İKİ AŞAMALI, BİLİNÇLİ OLARAK:
 *
 *   1. "Neyin taşınacağını göster" → `GET`, HİÇBİR ŞEY YAZMAZ. Kullanıcı
 *      kaç planın taşınacağını, kaçının neden atlanacağını görüyor.
 *   2. "Taşımayı uygula" → `POST`.
 *
 * Tek tıkla taşımak da mümkündü ama taşıma çok sayıda satır yazıyor; ne
 * olacağını görmeden onaylatmak, geri alması zor bir işlemi körü körüne
 * tetiklemek olurdu. (Taşımanın kendisi YIKICI DEĞİL — JSON sütunlarına
 * dokunulmuyor — ama kullanıcı bunu bilmek zorunda değil.)
 */

/** Kuru çalışma raporundaki tek plan. */
interface RaporSatiri {
  planId: string;
  city: string;
  durum: "tasinacak" | "atlanacak" | "zaten-tasinmis";
  engel?: string;
  uyarilar?: string[];
  sayilar?: { budgetItems: number; dailyPlans: number };
}

interface KuruCalisma {
  ozet: {
    toplam: number;
    tasinacak: number;
    atlanacak: number;
    zatenTasinmis: number;
  };
  planlar: RaporSatiri[];
}

interface UygulamaOzeti {
  toplam: number;
  tasindi: number;
  atlandi: number;
  zatenTasinmis: number;
  hata: number;
}

/**
 * `TasimaEngeli` değerlerinin okunur karşılıkları.
 *
 * Sunucu `"tarih-tersine"` gibi bir kimlik dönüyor; kullanıcıya ham kimlik
 * göstermek "bunu nasıl düzeltirim?" sorusunu cevapsız bırakır.
 */
const ENGEL_METNI: Record<string, string> = {
  "tarih-yok": "Başlangıç/bitiş tarihi girilmemiş",
  "tarih-gecersiz": "Tarihler okunamıyor",
  "tarih-tersine": "Bitiş tarihi başlangıçtan önce",
  "sehir-yok": "Şehir bilgisi yok",
};

function engelMetni(engel?: string): string {
  if (!engel) return "Bilinmeyen sebep";
  return ENGEL_METNI[engel] ?? engel;
}

export function PlanTasima() {
  const [rapor, setRapor] = useState<KuruCalisma | null>(null);
  const [sonuc, setSonuc] = useState<UygulamaOzeti | null>(null);
  const [okunuyor, setOkunuyor] = useState(false);
  const [uygulaniyor, setUygulaniyor] = useState(false);

  const raporuGetir = async () => {
    setOkunuyor(true);
    setSonuc(null);

    try {
      const yanit = await fetch("/api/my-plans/migrate");
      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        toast.error(govde?.error || "Taşıma raporu alınamadı");
        return;
      }

      setRapor({ ozet: govde.ozet, planlar: govde.planlar ?? [] });
    } catch (hata) {
      logger.error("Taşıma raporu alınamadı", hata);
      toast.error("Taşıma raporu alınamadı");
    } finally {
      setOkunuyor(false);
    }
  };

  const tasimayiUygula = async () => {
    setUygulaniyor(true);

    try {
      const yanit = await fetch("/api/my-plans/migrate", { method: "POST" });
      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        // 429 dahil: uç taşımayı saatte 3 ile sınırlıyor.
        toast.error(govde?.error || "Taşıma tamamlanamadı");
        return;
      }

      setSonuc(govde.ozet);
      setRapor(null);

      if (govde.ozet?.hata > 0) {
        toast.error(`${govde.ozet.hata} plan taşınamadı`);
      } else {
        toast.success(`${govde.ozet?.tasindi ?? 0} plan taşındı`);
      }
    } catch (hata) {
      logger.error("Taşıma uygulanamadı", hata);
      toast.error("Taşıma tamamlanamadı");
    } finally {
      setUygulaniyor(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-6">
      <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
        Plan verisi
      </h3>

      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Planlarınız yeni veri modeline taşınabilir. Taşıma mevcut planlarınızı{" "}
        <strong className="font-medium text-[var(--fg)]">silmez</strong>; yalnızca
        bütçe ve günlük programı ayrı kayıtlara kopyalar. İstediğiniz zaman
        tekrar çalıştırabilirsiniz.
      </p>

      {sonuc && (
        <div className="mt-5">
          <Serit ton={sonuc.hata > 0 ? "uyari" : "olumlu"} baslik="Taşıma tamamlandı">
            {sonuc.tasindi} plan taşındı
            {sonuc.zatenTasinmis > 0 && `, ${sonuc.zatenTasinmis} zaten taşınmıştı`}
            {sonuc.atlandi > 0 && `, ${sonuc.atlandi} atlandı`}
            {sonuc.hata > 0 && `, ${sonuc.hata} hata verdi`}.
          </Serit>
        </div>
      )}

      {rapor && (
        <div className="mt-5">
          <div className="grid grid-cols-3 gap-2">
            <Olcum etiket="Taşınacak" deger={rapor.ozet.tasinacak} ton="aksan" />
            <Olcum etiket="Atlanacak" deger={rapor.ozet.atlanacak} />
            <Olcum etiket="Taşınmış" deger={rapor.ozet.zatenTasinmis} />
          </div>

          {/* Atlanan planların GEREKÇESİ gösteriliyor: "3 plan atlanacak"
              demek kullanıcıya yapabileceği bir şey bırakmaz, "tarihi yok"
              demek bırakır. */}
          {rapor.ozet.atlanacak > 0 && (
            <ul className="mt-4 space-y-1.5">
              {rapor.planlar
                .filter((p) => p.durum === "atlanacak")
                .map((p) => (
                  <li
                    key={p.planId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-[var(--fg-muted)] truncate">{p.city}</span>
                    <Rozet ton="uyari">{engelMetni(p.engel)}</Rozet>
                  </li>
                ))}
            </ul>
          )}

          {rapor.ozet.tasinacak === 0 && (
            <div className="mt-4">
              <Serit ton="bilgi">
                Taşınacak plan yok — hepsi ya taşınmış ya da eksik bilgi
                yüzünden taşınamıyor.
              </Serit>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        <Dugme
          tur="ikincil"
          className="w-full"
          bekliyor={okunuyor}
          onClick={raporuGetir}
        >
          {rapor ? "Raporu yenile" : "Neyin taşınacağını göster"}
        </Dugme>

        {/* Uygula düğmesi YALNIZCA rapor okunduktan ve taşınacak bir şey
            olduğu görüldükten sonra çıkıyor. */}
        {rapor && rapor.ozet.tasinacak > 0 && (
          <Dugme
            className="w-full"
            bekliyor={uygulaniyor}
            onClick={tasimayiUygula}
          >
            {rapor.ozet.tasinacak} planı taşı
          </Dugme>
        )}
      </div>
    </div>
  );
}
