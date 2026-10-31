"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { logger } from "@/lib/logger";
import { SEHIRLER } from "@/lib/seyahat-mesafe";
import {
  Alan,
  BagDugme,
  Dugme,
  GIRDI_SINIFI,
  GirisGerekli,
  Olcum,
  Rozet,
  SayfaBasi,
  SayfaKabugu,
  Serit,
  Yukleniyor,
  cx,
} from "@/components/ui";

/**
 * Ulaşım seçenekleri.
 *
 * BU SAYFA ARTIK DEMO DEĞİL (B4 · Adım 4).
 *
 * Eskiden ~350 satırlık sabit bir `SEFERLER` dizisi vardı: dört şehir, yedi
 * günlük uydurma sefer tablosu, sahte koltuk sayıları. Sayfa gerçek bir
 * arama yapıyormuş gibi görünüyordu ve tek dürüstlüğü listenin üstündeki
 * "Demo veri" şeridiydi.
 *
 * Şimdi `GET /api/transport-options` çağrılıyor. O uç iki katman döndürüyor
 * ve ikisi de gerçek:
 *
 *  1. **Tahmin** — 81 ilin koordinatından hesaplanan mesafe, moda göre süre
 *     ve maliyet (`src/lib/seyahat-mesafe.ts`). Çevrimdışı ve her zaman var.
 *  2. **Kaynak** — Tavily aramasından gelen gerçek satış siteleri
 *     (`src/lib/ulasim-arama.ts`). Anahtar yoksa sessizce boş kalıyor.
 *
 * NEDEN SEFER SAATİ / KOLTUK YOK: bu bir sefer tarifesi değil. Gerçek
 * kalkış saatini ve boş koltuğu ancak bir rezervasyon sağlayıcısı bilir.
 * Uydurma bir saat göstermek, kaldırdığımız demo verinin aynısı olurdu.
 * Kullanıcı kalkış saatini KENDİSİ giriyor; varış, tahmini süreden
 * hesaplanıyor.
 *
 * KAYDETME (B4): seçilen seçenek `POST /api/trip/transportations` ile
 * ilişkisel modele yazılıyor. Yalnızca taşınmış planlarda mümkün —
 * `Transportation` satırı bir `Trip`e bağlı ve o `Trip` taşımayla oluşuyor.
 */

/* -------------------------------------------------------------------------- */
/* Tipler                                                                     */
/* -------------------------------------------------------------------------- */

interface UlasimKaynagi {
  baslik: string;
  url: string;
  ozet: string;
}

interface UlasimSecenegi {
  tur: string;
  saglayici: string;
  sureDk: number;
  sureMetni: string;
  tahminiTl: number;
  mesafeKm: number;
  maliyetBirimi: "kisi" | "arac";
  kaynaklar: UlasimKaynagi[];
}

interface Rota {
  nereden: string;
  nereye: string;
  kusUcusuKm: number;
  karayoluKm: number;
  secenekler: UlasimSecenegi[];
  webAramasiYapildi: boolean;
}

interface Plan {
  id: string;
  city: string;
  country: string | null;
  originCity?: string | null;
  startDate: string | null;
  endDate: string | null;
  migratedAt?: string | null;
  tripId?: string | null;
}

/** Plan ilişkisel modelde mi yaşıyor? Kaydetmenin ön koşulu. */
function iliskiselMi(plan: Plan | null): plan is Plan & { tripId: string } {
  return Boolean(plan?.migratedAt && plan?.tripId);
}

const SEHIR_ADLARI = SEHIRLER.map((s) => s.ad);

/** Bugüne `gun` ekleyip `YYYY-MM-DD` döndürür. */
function gunEkle(gun: number): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + gun);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate()
  ).padStart(2, "0")}`;
}

/** "2026-11-04" + "09:00" + 320 dk → varış ISO damgası. */
function varisZamani(tarih: string, saat: string, sureDk: number): string {
  const [yil, ay, gun] = tarih.split("-").map(Number);
  const [ss, dd] = saat.split(":").map(Number);
  const kalkis = new Date(yil, (ay ?? 1) - 1, gun ?? 1, ss ?? 0, dd ?? 0);
  return new Date(kalkis.getTime() + sureDk * 60_000).toISOString();
}

function kalkisZamani(tarih: string, saat: string): string {
  const [yil, ay, gun] = tarih.split("-").map(Number);
  const [ss, dd] = saat.split(":").map(Number);
  return new Date(yil, (ay ?? 1) - 1, gun ?? 1, ss ?? 0, dd ?? 0).toISOString();
}

const ikonOrtak = {
  fill: "none" as const,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/**
 * Tip ikonu.
 *
 * Ulaşım tipi eskiden RENKLE ayrılıyordu (uçak mavi, otobüs yeşil, tren
 * gri). Üçü de aynı türde şey — bir seyahat seçeneği. Renk anlam taşımadığı
 * yerde gürültüdür; ayrım ikonda.
 */
function TipIkonu({ tip }: { tip: string }) {
  if (tip === "Uçak") {
    return (
      <svg {...ikonOrtak} className="h-5 w-5">
        <path d="M10.2 20.3l1.6-5.1 3.4-1.1 4.7 3.1a1.2 1.2 0 001.8-1.4l-2.4-5.2 1.6-.5a2 2 0 10-1.2-3.8l-1.6.5-3.9-4.2a1.2 1.2 0 00-2 1l.4 5.6-3.4 1.1-3.5-3.1-1.4.5 2.3 4.4-1.6 2.2z" />
      </svg>
    );
  }
  if (tip === "Otobüs") {
    return (
      <svg {...ikonOrtak} className="h-5 w-5">
        <path d="M6 19a2 2 0 002 2h8a2 2 0 002-2m-12 0V7a2 2 0 012-2h8a2 2 0 012 2v12m-12 0h12M9 21v-2m6 2v-2M8 9h8M7.5 15h.01M16.5 15h.01" />
      </svg>
    );
  }
  if (tip === "Kendi aracı") {
    return (
      <svg {...ikonOrtak} className="h-5 w-5">
        <path d="M5 13l1.5-4.5A2 2 0 018.4 7h7.2a2 2 0 011.9 1.5L19 13m-14 0h14m-14 0v4a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-4M7.5 16h.01M16.5 16h.01" />
      </svg>
    );
  }
  return (
    <svg {...ikonOrtak} className="h-5 w-5">
      <path d="M8 20l-2 2m10-2l2 2M5 16V6a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2zM5 10h14M8.5 14h.01M15.5 14h.01" />
    </svg>
  );
}

/** Rota segmenti: kalkış ● ——— ● varış, ortada süre. */
function RotaHatti({ sure }: { sure: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[7rem] flex-1" aria-hidden="true">
      <span className="h-2 w-2 shrink-0 rounded-full border-[1.5px] border-[var(--route-vivid)] bg-[var(--surface)]" />
      <span className="relative h-px flex-1 bg-[repeating-linear-gradient(to_right,var(--route-border)_0_5px,transparent_5px_10px)]">
        <span className="lejant absolute left-1/2 -translate-x-1/2 -top-[1.15rem] whitespace-nowrap text-[var(--fg-subtle)] sayisal">
          {sure}
        </span>
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--route-vivid)]" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export default function TransportationPage() {
  const { status } = useSession();

  const [planlar, setPlanlar] = useState<Plan[]>([]);
  const [seciliPlan, setSeciliPlan] = useState<Plan | null>(null);

  const [from, setFrom] = useState("Ankara");
  const [to, setTo] = useState("İstanbul");
  const [date, setDate] = useState(() => gunEkle(0));
  const [saat, setSaat] = useState("09:00");
  const [type, setType] = useState("all");
  const [sortBy, setSortBy] = useState("price");

  const [rota, setRota] = useState<Rota | null>(null);
  const [araniyor, setAraniyor] = useState(false);
  const [kaydedilen, setKaydedilen] = useState<string | null>(null);

  /* Planları getir; güzergâhı ilk plandan ön doldur. */
  const planlariGetir = useCallback(async () => {
    try {
      const yanit = await fetch("/api/my-plans");
      if (!yanit.ok) return;

      const govde = await yanit.json();
      const gelen: Plan[] = Array.isArray(govde?.plans) ? govde.plans : [];
      setPlanlar(gelen);

      if (gelen.length > 0) {
        const p = gelen[0];
        setSeciliPlan(p);
        // Varış planın şehri; kalkış `originCity` doluysa oradan.
        if (SEHIR_ADLARI.includes(p.city)) setTo(p.city);
        const kalkis = p.originCity;
        if (kalkis && SEHIR_ADLARI.includes(kalkis)) setFrom(kalkis);
        // Tarih planın başlangıcı olsun: varsayılan "bugün" kalırsa
        // kaydedilen ulaşım seyahat aralığının tamamen dışına düşüyor.
        if (p.startDate) setDate(p.startDate.slice(0, 10));
      }
    } catch (hata) {
      logger.error("Planlar getirilemedi", hata);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") planlariGetir();
  }, [status, planlariGetir]);

  const ara = useCallback(async () => {
    if (from === to) {
      toast.error("Kalkış ve varış şehri aynı olamaz");
      return;
    }

    setAraniyor(true);
    setKaydedilen(null);

    try {
      const yanit = await fetch(
        `/api/transport-options?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        toast.error(govde?.error || "Ulaşım seçenekleri alınamadı");
        setRota(null);
        return;
      }

      setRota(govde.rota as Rota);
    } catch (hata) {
      logger.error("Ulaşım seçenekleri alınamadı", hata);
      toast.error("Ulaşım seçenekleri alınamadı");
      setRota(null);
    } finally {
      setAraniyor(false);
    }
  }, [from, to]);

  /** Seçeneği plana yazar (ilişkisel model). */
  const planaKaydet = async (secenek: UlasimSecenegi) => {
    if (!iliskiselMi(seciliPlan)) return;

    try {
      const yanit = await fetch("/api/trip/transportations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: seciliPlan.tripId,
          type: secenek.tur,
          provider: secenek.saglayici,
          departureTime: kalkisZamani(date, saat),
          // Varış saati TAHMİNİ süreden hesaplanıyor; gerçek bir tarife yok.
          arrivalTime: varisZamani(date, saat, secenek.sureDk),
          departureLocation: rota?.nereden ?? from,
          arrivalLocation: rota?.nereye ?? to,
          price: secenek.tahminiTl,
          notes:
            `Tahmini: ${secenek.sureMetni}, ${secenek.mesafeKm} km. ` +
            `Tutar ${secenek.maliyetBirimi === "arac" ? "araç" : "kişi"} başına.`,
        }),
      });

      const govde = await yanit.json().catch(() => null);
      if (!yanit.ok) {
        toast.error(govde?.error || "Plana kaydedilemedi");
        return;
      }

      setKaydedilen(secenek.tur);
      toast.success(`${secenek.tur} planınıza eklendi`);
    } catch (hata) {
      logger.error("Ulaşım plana kaydedilemedi", hata);
      toast.error("Plana kaydedilemedi");
    }
  };

  const secenekler = useMemo(() => {
    const hepsi = rota?.secenekler ?? [];
    const suzulmus = type === "all" ? hepsi : hepsi.filter((s) => s.tur === type);

    return [...suzulmus].sort((a, b) => {
      if (sortBy === "price") return a.tahminiTl - b.tahminiTl;
      if (sortBy === "duration") return a.sureDk - b.sureDk;
      return 0;
    });
  }, [rota, type, sortBy]);

  if (status === "loading") {
    return (
      <SayfaKabugu>
        <Yukleniyor metin="Yükleniyor…" />
      </SayfaKabugu>
    );
  }

  if (status === "unauthenticated") {
    return (
      <SayfaKabugu>
        <GirisGerekli aciklama="Ulaşım seçeneklerini görmek ve planınıza eklemek için giriş yapın." />
      </SayfaKabugu>
    );
  }

  const kaydedilebilir = iliskiselMi(seciliPlan);

  return (
    <SayfaKabugu>
      <SayfaBasi
        baslik="Ulaşım seçenekleri"
        aciklama="Uçak, otobüs, tren ve kendi aracı alternatiflerini yan yana karşılaştırın."
        yan={
          <BagDugme href="/travel-mode" tur="ikincil">
            Plana dön
          </BagDugme>
        }
      />

      {/* Uyarı sonuçların ÜSTÜNDE: kullanıcı neyle karşılaştığını, sayıları
          okumadan önce bilmeli. Artık "demo" değil ama yine de TAHMİN. */}
      <div className="mb-8">
        <Serit ton="bilgi" baslik="Bu sayılar tahmindir">
          Süre ve maliyet, iki şehir arasındaki mesafeden hesaplanır; sefer
          tarifesi ya da canlı bilet fiyatı değildir. Güncel fiyat için her
          seçeneğin altındaki satış sitesi bağlantılarını kullanın. Uygulama
          üzerinden bilet satın alınmaz.
        </Serit>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Arama                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <Alan etiket="Nereden" htmlFor="from">
            <select
              id="from"
              className={GIRDI_SINIFI}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {SEHIR_ADLARI.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Alan>

          <Alan etiket="Nereye" htmlFor="to">
            <select
              id="to"
              className={GIRDI_SINIFI}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {SEHIR_ADLARI.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Alan>

          <Alan etiket="Tarih" htmlFor="date">
            <input
              type="date"
              id="date"
              className={cx(GIRDI_SINIFI, "sayisal")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Alan>

          {/* Kalkış saatini KULLANICI giriyor: gerçek tarife bilgimiz yok,
              uydurmak demo veriye geri dönmek olurdu. */}
          <Alan etiket="Kalkış saati" htmlFor="saat" ipucu="Varış süreden hesaplanır.">
            <input
              type="time"
              id="saat"
              className={cx(GIRDI_SINIFI, "sayisal")}
              value={saat}
              onChange={(e) => setSaat(e.target.value)}
            />
          </Alan>

          <Alan etiket="Ulaşım tipi" htmlFor="type">
            <select
              id="type"
              className={GIRDI_SINIFI}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all">Tümü</option>
              <option value="Uçak">Uçak</option>
              <option value="Otobüs">Otobüs</option>
              <option value="Tren">Tren</option>
              <option value="Kendi aracı">Kendi aracı</option>
            </select>
          </Alan>

          <Dugme type="button" className="w-full" onClick={ara} bekliyor={araniyor}>
            Ara
          </Dugme>
        </div>

        {planlar.length > 0 && (
          <div className="mt-5 border-t border-[var(--line)] pt-5">
            <Alan
              etiket="Hangi plana eklenecek?"
              htmlFor="plan"
              ipucu={
                kaydedilebilir
                  ? undefined
                  : "Bu plan henüz yeni veri modeline taşınmadı; profil sayfasından taşıyabilirsiniz."
              }
            >
              <select
                id="plan"
                className={GIRDI_SINIFI}
                value={seciliPlan?.id ?? ""}
                onChange={(e) => {
                  const secilen = planlar.find((p) => p.id === e.target.value) ?? null;
                  setSeciliPlan(secilen);
                  // Plan değişince güzergâh ve tarih de o plana uysun;
                  // aksi halde kullanıcı A planına bakarken B planının
                  // güzergâhını kaydedebiliyordu.
                  if (secilen) {
                    if (SEHIR_ADLARI.includes(secilen.city)) setTo(secilen.city);
                    if (secilen.originCity && SEHIR_ADLARI.includes(secilen.originCity)) {
                      setFrom(secilen.originCity);
                    }
                    if (secilen.startDate) setDate(secilen.startDate.slice(0, 10));
                  }
                }}
              >
                {planlar.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.city}
                    {p.country ? `, ${p.country}` : ""}
                    {p.migratedAt ? "" : " (taşınmamış)"}
                  </option>
                ))}
              </select>
            </Alan>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sonuçlar                                                            */}
      {/* ------------------------------------------------------------------ */}
      {rota && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)]">
            {rota.nereden} → {rota.nereye}
            <span className="lejant text-[var(--fg-subtle)] ml-3 sayisal">
              {rota.karayoluKm} km karayolu
            </span>
          </h2>

          <div className="flex items-center gap-2">
            <label htmlFor="sortBy" className="lejant text-[var(--fg-subtle)]">
              Sırala
            </label>
            <select
              id="sortBy"
              className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="price">Maliyet</option>
              <option value="duration">Süre</option>
            </select>
          </div>
        </div>
      )}

      {!rota ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] px-6 py-14 text-center">
          <h3 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)]">
            Güzergâh seçin
          </h3>
          <p className="text-[var(--fg-muted)] mt-2 max-w-md mx-auto leading-relaxed">
            Kalkış ve varış şehrini seçip &ldquo;Ara&rdquo;ya basın. Süre ve
            maliyet iki şehrin mesafesinden hesaplanır.
          </p>
        </div>
      ) : secenekler.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] px-6 py-14 text-center">
          <h3 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)]">
            Bu güzergâhta seçenek yok
          </h3>
          <p className="text-[var(--fg-muted)] mt-2 max-w-md mx-auto leading-relaxed">
            Seçtiğiniz ulaşım tipi bu güzergâhta sunulmuyor. Örneğin tren,
            yalnızca demiryolu ağındaki iller arasında gösteriliyor.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {secenekler.map((secenek) => (
            <li
              key={secenek.tur}
              className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-5 transition-[border-color,box-shadow] duration-200 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-pop)]"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                <div className="flex items-center gap-3 lg:w-48 shrink-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius)] border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]">
                    <TipIkonu tip={secenek.tur} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--fg)] truncate">{secenek.tur}</p>
                    <p className="text-sm text-[var(--fg-muted)] truncate">
                      {secenek.saglayici}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 items-center gap-4 pt-4 lg:pt-0">
                  <div className="text-right shrink-0">
                    <p className="font-[family-name:var(--font-geist-mono)] text-lg text-[var(--fg)] sayisal leading-none">
                      {saat}
                    </p>
                    <p className="text-sm text-[var(--fg-muted)] mt-1">{rota.nereden}</p>
                  </div>

                  <RotaHatti sure={secenek.sureMetni} />

                  <div className="shrink-0">
                    <p className="font-[family-name:var(--font-geist-mono)] text-lg text-[var(--fg)] sayisal leading-none">
                      {secenek.mesafeKm} km
                    </p>
                    <p className="text-sm text-[var(--fg-muted)] mt-1">{rota.nereye}</p>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4 border-t border-[var(--line)] pt-4 lg:w-56 lg:shrink-0 lg:border-t-0 lg:pt-0 lg:justify-end">
                  <div>
                    <Olcum
                      etiket={
                        // Bilette maliyet kişi başına, kendi aracında araç
                        // başınadır ve yolcu sayısına bölünür. İkisini aynı
                        // etiketle göstermek kalabalık grupta araba
                        // maliyetini kat kat şişiriyordu.
                        secenek.maliyetBirimi === "arac" ? "Araç başı" : "Kişi başı"
                      }
                      deger={`${secenek.tahminiTl.toLocaleString("tr-TR")} ₺`}
                      ton="aksan"
                    />
                    <div className="mt-2">
                      <Rozet ton="notr">tahmini</Rozet>
                    </div>
                  </div>

                  {kaydedilebilir && (
                    <Dugme
                      boy="sm"
                      tur={kaydedilen === secenek.tur ? "ikincil" : "rota"}
                      onClick={() => planaKaydet(secenek)}
                    >
                      {kaydedilen === secenek.tur ? "Eklendi" : "Plana ekle"}
                    </Dugme>
                  )}
                </div>
              </div>

              {/* Gerçek satış siteleri. Boşsa hiç gösterilmiyor: "kaynak yok"
                  başlığı altında boş bir alan bırakmak bilgi vermiyor. */}
              {secenek.kaynaklar.length > 0 && (
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  <p className="lejant text-[var(--fg-subtle)] mb-2">Güncel fiyat için</p>
                  <ul className="flex flex-wrap gap-2">
                    {secenek.kaynaklar.map((k) => (
                      <li key={k.url}>
                        <a
                          href={k.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-full border border-[var(--line-strong)] px-3 py-1 text-xs text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          title={k.ozet}
                        >
                          {k.baslik}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SayfaKabugu>
  );
}
