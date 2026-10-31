"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { logger } from "@/lib/logger";
import { geceSayisi } from "@/lib/trip-dates";
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
 * Konaklama.
 *
 * BU SAYFA ARTIK DEMO DEĞİL (B4 · Adım 4) — ama ulaşımdan FARKLI bir
 * şekilde çözülüyor ve bu fark bilinçli.
 *
 * Eskiden beş uydurma otel vardı: sahte yıldız, sahte fiyat, sahte olanak
 * listesi, sahte puan. Sayfa gerçek bir otel aramasıymış gibi görünüyordu.
 *
 * NEDEN ULAŞIMDAKİ ÇÖZÜM BURADA İŞE YARAMIYOR: ulaşım süresi ve maliyeti
 * iki şehrin MESAFESİNDEN türetilebiliyor — fizik. Otel fiyatı böyle bir
 * şeyden türetilemez; oda müsaitliği ve gecelik fiyat ancak bir tedarikçi
 * API'sinden (Booking, Amadeus) gelir ve o bir sözleşme/maliyet kararı.
 *
 * Uydurmakla tedarikçi arasındaki dürüst orta yol: zaten kurulu olan arama
 * sağlayıcısıyla GERÇEK fiyat sayfalarını bulmak
 * (`GET /api/accommodation-options`), ve kullanıcının seçtiği konaklamayı
 * KENDİSİNİN girmesine izin vermek. Yani sayfa artık iki iş yapıyor:
 *
 *   1. Nerede arayacağını göster (gerçek bağlantılar).
 *   2. Bulduğunu plana kaydet (`POST /api/trip/accommodations`).
 *
 * Uydurma bir yıldız ya da puan göstermiyoruz; bilmediğimiz şeyi
 * göstermemek, yanlış göstermekten iyidir.
 */

interface Kaynak {
  baslik: string;
  url: string;
  ozet: string;
  alan: string;
}

interface Plan {
  id: string;
  city: string;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  migratedAt?: string | null;
  tripId?: string | null;
}

/** Plan ilişkisel modelde mi yaşıyor? Kaydetmenin ön koşulu. */
function iliskiselMi(plan: Plan | null): plan is Plan & { tripId: string } {
  return Boolean(plan?.migratedAt && plan?.tripId);
}

/** Bugüne `gun` ekleyip `YYYY-MM-DD` döndürür. */
function gunEkle(gun: number): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + gun);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate()
  ).padStart(2, "0")}`;
}

/** ISO tarihi `YYYY-MM-DD` biçimine indirger; boşsa boş döner. */
function isoKisalt(value: string | null | undefined): string {
  return (value ?? "").slice(0, 10);
}

export default function AccommodationPage() {
  const { status } = useSession();

  const [planlar, setPlanlar] = useState<Plan[]>([]);
  const [seciliPlan, setSeciliPlan] = useState<Plan | null>(null);

  const [city, setCity] = useState("İstanbul");
  const [checkIn, setCheckIn] = useState(() => gunEkle(14));
  const [checkOut, setCheckOut] = useState(() => gunEkle(17));
  const [butceSeviyesi, setButceSeviyesi] = useState("");

  const [kaynaklar, setKaynaklar] = useState<Kaynak[] | null>(null);
  const [aramaAcik, setAramaAcik] = useState(true);
  const [araniyor, setAraniyor] = useState(false);

  // Kaydetme formu
  const [ad, setAd] = useState("");
  const [konum, setKonum] = useState("");
  const [ucret, setUcret] = useState(0);
  const [ucretBirimi, setUcretBirimi] = useState<"total" | "night">("night");
  const [rezervasyonUrl, setRezervasyonUrl] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const gece = geceSayisi(checkIn, checkOut);

  /* Planları getir; şehir ve tarihleri ilk plandan ön doldur. */
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
        setCity(p.city);
        // Konaklama aralığı planın tarih aralığıyla başlasın; kullanıcı
        // zaten oraya gidiyor.
        if (p.startDate) setCheckIn(isoKisalt(p.startDate));
        if (p.endDate) setCheckOut(isoKisalt(p.endDate));
      }
    } catch (hata) {
      logger.error("Planlar getirilemedi", hata);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") planlariGetir();
  }, [status, planlariGetir]);

  const ara = useCallback(async () => {
    if (!city.trim()) {
      toast.error("Şehir gereklidir");
      return;
    }

    setAraniyor(true);
    try {
      const q = new URLSearchParams({ city, checkIn, checkOut });
      if (butceSeviyesi) q.set("budgetLevel", butceSeviyesi);

      const yanit = await fetch(`/api/accommodation-options?${q.toString()}`);
      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        toast.error(govde?.error || "Konaklama seçenekleri alınamadı");
        return;
      }

      setAramaAcik(govde.yapilandirildi !== false);
      setKaynaklar(Array.isArray(govde.kaynaklar) ? govde.kaynaklar : []);
    } catch (hata) {
      logger.error("Konaklama seçenekleri alınamadı", hata);
      toast.error("Konaklama seçenekleri alınamadı");
    } finally {
      setAraniyor(false);
    }
  }, [city, checkIn, checkOut, butceSeviyesi]);

  const planaKaydet = async () => {
    if (!iliskiselMi(seciliPlan)) return;

    if (!ad.trim()) {
      toast.error("Konaklama adı gereklidir");
      return;
    }
    if (ucret <= 0) {
      toast.error("Ücret sıfırdan büyük olmalıdır");
      return;
    }
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      toast.error("Çıkış tarihi giriş tarihinden sonra olmalıdır");
      return;
    }

    setKaydediliyor(true);
    try {
      const yanit = await fetch("/api/trip/accommodations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: seciliPlan.tripId,
          name: ad.trim(),
          ...(konum.trim() ? { location: konum.trim() } : {}),
          checkIn,
          checkOut,
          price: Math.round(ucret),
          priceUnit: ucretBirimi,
          // Boş string `.url()` doğrulamasına takılır; yalnızca doluysa
          // gönderiliyor.
          ...(rezervasyonUrl.trim() ? { bookingUrl: rezervasyonUrl.trim() } : {}),
        }),
      });

      const govde = await yanit.json().catch(() => null);
      if (!yanit.ok) {
        toast.error(govde?.error || "Plana kaydedilemedi");
        return;
      }

      toast.success(`${ad.trim()} planınıza eklendi`);
      setAd("");
      setKonum("");
      setUcret(0);
      setRezervasyonUrl("");
    } catch (hata) {
      logger.error("Konaklama plana kaydedilemedi", hata);
      toast.error("Plana kaydedilemedi");
    } finally {
      setKaydediliyor(false);
    }
  };

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
        <GirisGerekli aciklama="Konaklama aramak ve planınıza eklemek için giriş yapın." />
      </SayfaKabugu>
    );
  }

  const kaydedilebilir = iliskiselMi(seciliPlan);
  const toplamTutar = ucretBirimi === "night" ? ucret * Math.max(gece, 1) : ucret;

  return (
    <SayfaKabugu>
      <SayfaBasi
        baslik="Konaklama"
        aciklama="Güncel fiyatları bulun, seçtiğiniz konaklamayı planınıza ekleyin."
        yan={
          <BagDugme href="/travel-mode" tur="ikincil">
            Plana dön
          </BagDugme>
        }
      />

      {/* Ne olduğunu ve ne OLMADIĞINI listeden önce söylüyoruz. */}
      <div className="mb-8">
        <Serit ton="bilgi" baslik="Bu bir rezervasyon servisi değil">
          Arama, konaklama fiyatları hakkında yazan gerçek siteleri getirir;
          oda müsaitliği ve kesin fiyat için o sitelere gidin. Uygulama
          üzerinden rezervasyon yapılmaz — seçtiğiniz konaklamayı aşağıdan
          kendiniz planınıza ekleyebilirsiniz.
        </Serit>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Arama                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <Alan etiket="Şehir" htmlFor="city">
            <input
              id="city"
              className={GIRDI_SINIFI}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Örn. Roma"
            />
          </Alan>

          <Alan etiket="Giriş" htmlFor="checkIn">
            <input
              type="date"
              id="checkIn"
              className={cx(GIRDI_SINIFI, "sayisal")}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </Alan>

          <Alan
            etiket="Çıkış"
            htmlFor="checkOut"
            ipucu={gece > 0 ? `${gece} gece` : undefined}
          >
            <input
              type="date"
              id="checkOut"
              className={cx(GIRDI_SINIFI, "sayisal")}
              value={checkOut}
              min={checkIn}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </Alan>

          <Alan etiket="Bütçe" htmlFor="butce">
            <select
              id="butce"
              className={GIRDI_SINIFI}
              value={butceSeviyesi}
              onChange={(e) => setButceSeviyesi(e.target.value)}
            >
              <option value="">Fark etmez</option>
              <option value="ekonomik">Ekonomik</option>
              <option value="lüks">Lüks</option>
            </select>
          </Alan>

          <Dugme type="button" className="w-full" onClick={ara} bekliyor={araniyor}>
            Ara
          </Dugme>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Kaynaklar                                                           */}
      {/* ------------------------------------------------------------------ */}
      {kaynaklar !== null && (
        <div className="mb-8">
          <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-4">
            Fiyat kaynakları
            <span className="lejant text-[var(--fg-subtle)] ml-3 sayisal">
              {kaynaklar.length} site
            </span>
          </h2>

          {!aramaAcik ? (
            <Serit ton="uyari" baslik="Arama yapılandırılmamış">
              Bu sunucuda arama sağlayıcısı tanımlı değil, bu yüzden fiyat
              kaynağı getirilemiyor. Konaklamanızı yine de aşağıdan elle
              ekleyebilirsiniz.
            </Serit>
          ) : kaynaklar.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] px-6 py-12 text-center">
              <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                Sonuç bulunamadı
              </h3>
              <p className="text-[var(--fg-muted)] mt-2 max-w-md mx-auto leading-relaxed">
                Bu şehir ve tarih için fiyat sayfası bulunamadı. Şehir adını
                farklı yazmayı ya da bütçe filtresini kaldırmayı deneyin.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {kaynaklar.map((k) => (
                <li
                  key={k.url}
                  className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-5 transition-[border-color,box-shadow] duration-200 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-pop)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <a
                        href={k.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--fg)] hover:text-[var(--accent)] transition-colors"
                      >
                        {k.baslik}
                      </a>
                      <p className="mt-1">
                        <Rozet ton="notr">{k.alan}</Rozet>
                      </p>
                      {k.ozet && (
                        <p className="text-sm text-[var(--fg-muted)] mt-2 leading-relaxed">
                          {k.ozet}
                        </p>
                      )}
                    </div>

                    {/* Bu bağlantıyı kaydetme formuna taşıyor: kullanıcı
                        siteye gidip fiyatı gördükten sonra geri döndüğünde
                        adresi yeniden yapıştırmak zorunda kalmasın. */}
                    <Dugme
                      boy="sm"
                      tur="ikincil"
                      className="shrink-0"
                      onClick={() => {
                        setRezervasyonUrl(k.url);
                        toast.success("Bağlantı forma eklendi");
                      }}
                    >
                      Forma ekle
                    </Dugme>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Plana ekle                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-6">
        <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)]">
          Konaklamayı plana ekle
        </h2>
        <p className="text-sm text-[var(--fg-muted)] mt-2">
          Seçtiğiniz konaklamanın bilgilerini girin; plan detayınıza kaydedilir.
        </p>

        {planlar.length === 0 ? (
          <div className="mt-5">
            <Serit ton="bilgi">
              Henüz bir planınız yok.{" "}
              <BagDugme href="/travel-mode" tur="ikincil" boy="sm">
                Plan oluşturun
              </BagDugme>
            </Serit>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Alan
                etiket="Hangi plana?"
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
                  onChange={(e) =>
                    setSeciliPlan(planlar.find((p) => p.id === e.target.value) ?? null)
                  }
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

              <Alan etiket="Konaklama adı" htmlFor="ad">
                <input
                  id="ad"
                  className={GIRDI_SINIFI}
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  placeholder="Örn. Hotel Roma Centro"
                />
              </Alan>

              <Alan etiket="Konum" htmlFor="konum">
                <input
                  id="konum"
                  className={GIRDI_SINIFI}
                  value={konum}
                  onChange={(e) => setKonum(e.target.value)}
                  placeholder="Örn. Termini civarı"
                />
              </Alan>

              <Alan etiket="Ücret (₺)" htmlFor="ucret">
                <div className="flex gap-2">
                  <input
                    type="number"
                    id="ucret"
                    min={0}
                    className={cx(GIRDI_SINIFI, "sayisal")}
                    value={ucret || ""}
                    onChange={(e) => setUcret(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <select
                    aria-label="Ücret birimi"
                    className={cx(GIRDI_SINIFI, "w-36 shrink-0")}
                    value={ucretBirimi}
                    onChange={(e) =>
                      setUcretBirimi(e.target.value === "total" ? "total" : "night")
                    }
                  >
                    <option value="night">gecelik</option>
                    <option value="total">toplam</option>
                  </select>
                </div>
              </Alan>

              <Alan
                etiket="Rezervasyon bağlantısı"
                htmlFor="url"
                ipucu="İsteğe bağlı. Yukarıdaki sonuçlardan da ekleyebilirsiniz."
              >
                <input
                  id="url"
                  className={GIRDI_SINIFI}
                  value={rezervasyonUrl}
                  onChange={(e) => setRezervasyonUrl(e.target.value)}
                  placeholder="https://…"
                />
              </Alan>

              <div className="flex items-end">
                {/* Gecelik girildiğinde toplam TUTARI GÖSTERİYORUZ: kullanıcı
                    "3.000" yazıp toplamın 9.000 olduğunu kaydettikten sonra
                    öğrenmesin. */}
                <Olcum
                  etiket={ucretBirimi === "night" ? `Toplam (${Math.max(gece, 1)} gece)` : "Toplam"}
                  deger={`₺${toplamTutar.toLocaleString("tr-TR")}`}
                  ton="aksan"
                />
              </div>
            </div>

            <div className="mt-6">
              <Dugme
                onClick={planaKaydet}
                bekliyor={kaydediliyor}
                disabled={!kaydedilebilir}
              >
                Plana ekle
              </Dugme>
              {!kaydedilebilir && (
                <p className="text-sm text-[var(--fg-subtle)] mt-3">
                  Kaydetmek için planın yeni veri modeline taşınmış olması
                  gerekiyor.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </SayfaKabugu>
  );
}
