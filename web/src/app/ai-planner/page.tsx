"use client";

import { useState, FormEvent, ChangeEvent, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast, Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitize";
import { logger } from "@/lib/logger";
import {
  Alan,
  BagDugme,
  Damga,
  Dugme,
  GIRDI_SINIFI,
  GirisGerekli,
  Ikon,
  Kocan,
  KonturDoku,
  SayfaBasi,
  SayfaKabugu,
  Yukleniyor,
  cx,
} from "@/components/ui";
import { SEHIRLER } from "@/lib/seyahat-mesafe";

interface TripFormData {
  city: string;
  country: string;
  /**
   * Kalkış şehri (B6).
   *
   * OPSİYONEL ve serbest metin: 81 il listesi yalnızca otomatik tamamlama
   * için. Zorunlu bir seçim kutusu, "zaten oradayım" ve yurt dışı
   * senaryolarını imkânsız kılardı.
   */
  originCity: string;
  startDate: string;
  endDate: string;
  budget: string;
  transportation: string[];
  interests: string[];
  specialRequirements: string;
  travelStyle: string;
  accommodation: string;
}

interface TripPlanResponse {
  success?: boolean;
  plan: {
    markdown: string;
    html: string;
    city: string;
    country: string;
    startDate: string | null;
    endDate: string | null;
    duration: string | null;
    tripPlanId?: string;
    metadata?: {
      generatedAt: string;
      model: string;
      savedToFile: string | null;
      savedToDatabase?: boolean;
    };
  };
}

/**
 * İş adımlarının kullanıcıya gösterilecek karşılığı.
 *
 * Sunucu `step` alanına teknik bir etiket yazıyor (`yapilandirilmis-uretim`
 * gibi); kullanıcı onu görmemeli.
 */
const ADIM_METINLERI: Record<string, string> = {
  basladi: "Hazırlık yapılıyor...",
  "agentic-uretim": "AI rotaları ve önerileri araştırıyor...",
  "yapilandirilmis-uretim": "AI rotaları ve önerileri araştırıyor...",
  "markdown-yedegi": "Alternatif yöntem deneniyor...",
  "konumlar-cozuluyor": "Konumlar haritaya işleniyor...",
  kaydediliyor: "Plan kaydediliyor...",
  tamamlandi: "Tamamlandı",
};

/**
 * Adım metnini çözer. `arac:web_search` gibi araç adına göre değişen
 * adımlar sabit haritada tek tek tanımlanmıyor — yeni bir araç eklendiğinde
 * bu sayfanın güncellenmesi gerekmesin diye `arac:` önekiyle başlayan her
 * adım aynı genel mesajı gösteriyor.
 */
function adimMetni(step: string): string | null {
  if (ADIM_METINLERI[step]) return ADIM_METINLERI[step];
  if (step.startsWith("arac:")) return "Güncel bilgi aranıyor...";
  return null;
}

/** İş bitene kadar bekle; her yoklama arasında `bekleMs` kadar durakla. */
function bekle(ms: number): Promise<void> {
  return new Promise((cozumle) => setTimeout(cozumle, ms));
}

export default function PlannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [ilerlemeMetni, setIlerlemeMetni] = useState<string>("");
  const [tripPlan, setTripPlan] = useState<TripPlanResponse | null>(null);
  const [formData, setFormData] = useState<TripFormData>({
    city: "",
    country: "",
    originCity: "",
    startDate: "",
    endDate: "",
    budget: "",
    transportation: [],
    interests: [],
    specialRequirements: "",
    travelStyle: "",
    accommodation: "",
  });

  // Bugünün tarihini al (YYYY-MM-DD formatında)
  const today = new Date().toISOString().split('T')[0];

  const handleCheckboxChange = useCallback((type: "transportation" | "interests", value: string) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(item => item !== value)
        : [...prev[type], value]
    }));
  }, []);

  // Session kontrol
  if (status === 'loading') {
    return (
      <SayfaKabugu>
        <Yukleniyor metin="Oturum kontrol ediliyor…" />
      </SayfaKabugu>
    );
  }

  if (status === 'unauthenticated') {
    return <GirisGerekli />;
  }

  // Form kontrollerini güncelleme fonksiyonları
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData({
      ...formData,
      [id]: value,
    });
  };

  // Form gönderme işlemi
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Form validasyonu
    if (!formData.city) {
      toast.error("Lütfen en azından şehir bilgisini girin");
      return;
    }

    // Tarih kontrolü
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const todayDate = new Date(today);
      
      if (start < todayDate) {
        toast.error("Başlangıç tarihi bugünden önce olamaz");
        return;
      }
      
      if (end < todayDate) {
        toast.error("Bitiş tarihi bugünden önce olamaz");
        return;
      }
      
      if (start > end) {
        toast.error("Başlangıç tarihi Bitiş tarihinden sonra olamaz");
        return;
      }
    } else if (formData.startDate) {
      const start = new Date(formData.startDate);
      const todayDate = new Date(today);
      
      if (start < todayDate) {
        toast.error("Başlangıç tarihi bugünden önce olamaz");
        return;
      }
    } else if (formData.endDate) {
      const end = new Date(formData.endDate);
      const todayDate = new Date(today);
      
      if (end < todayDate) {
        toast.error("Bitiş tarihi bugünden önce olamaz");
        return;
      }
    }
    
    // Uç kimlik doğrulaması zorunlu kılıyor. Kontrolü BURADA yapmazsak
    // kullanıcı formu doldurup gönderiyor ve ancak yanıt dönünce 401
    // görüyordu.
    if (!session) {
      toast.error("Plan oluşturmak için giriş yapmalısınız");
      router.push("/login?callbackUrl=/ai-planner");
      return;
    }

    setIsGenerating(true);

    try {
      // DİKKAT: istemci kendi kimliğini GÖNDERMİYOR. Sunucu kullanıcıyı
      // oturumdan çözüyor; gövdedeki id/e-posta zaten yok sayılıyordu ve
      // gönderilmesi yanıltıcı bir güvenlik izlenimi veriyordu.
      // Uç artık planı DÖNDÜRMÜYOR: bir iş kaydı açıp 202 + jobId veriyor
      // (bkz. src/lib/plan-job.ts). Üretim 4 dakikaya kadar sürebildiği için
      // istek-yanıt döngüsünden çıkarıldı.
      const response = await fetch("/api/trip-plan-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const baslangic = await response.json();

      if (!response.ok) {
        throw new Error(baslangic.error || "Plan oluşturulurken bir hata oluştu");
      }

      const jobId: string | undefined = baslangic.jobId;
      if (!jobId) {
        throw new Error("Plan üretimi başlatılamadı");
      }

      setIlerlemeMetni(ADIM_METINLERI.basladi);

      // Yoklama: 2 sn aralıkla, en fazla 5 dakika. Üst sınır sunucudaki
      // toplam süre bütçesinden (240 sn) biraz uzun; asılı kalan işler
      // sunucu tarafında zaten FAILED'a çekiliyor.
      const YOKLAMA_ARALIGI_MS = 2000;
      const AZAMI_SURE_MS = 5 * 60 * 1000;
      const bitis = Date.now() + AZAMI_SURE_MS;

      let sonuc: TripPlanResponse | null = null;

      while (Date.now() < bitis) {
        await bekle(YOKLAMA_ARALIGI_MS);

        const durum = await fetch(`/api/plan-jobs/${jobId}`);
        if (!durum.ok) {
          throw new Error("Plan durumu okunamadı");
        }

        const govde = await durum.json();
        const is = govde.job;

        if (is?.step) {
          const metin = adimMetni(is.step);
          if (metin) setIlerlemeMetni(metin);
        }

        if (is?.status === "FAILED") {
          throw new Error(is.error || "Plan oluşturulamadı");
        }

        if (is?.status === "SUCCEEDED" && govde.plan) {
          sonuc = { success: true, plan: govde.plan };
          break;
        }
      }

      if (!sonuc) {
        throw new Error(
          "Plan üretimi beklenenden uzun sürdü. Planlarım sayfasından birazdan kontrol edebilirsiniz."
        );
      }

      setTripPlan(sonuc);
      toast.success("Seyahat planınız hazırlandı!");

      // Otomatik olarak sonuç bölümüne kaydır
      document.getElementById("trip-plan-result")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      logger.error("Seyahat planı oluşturulamadı", error);
      toast.error(error instanceof Error ? error.message : "Plan oluşturulurken bir hata oluştu");
    } finally {
      setIsGenerating(false);
      setIlerlemeMetni("");
    }
  };

  // Planı PDF olarak indir (basit bir yöntem)
  const handleDownloadPDF = () => {
    // Bu gerçek bir PDF oluşturma işlemi değil, gerçek bir uygulamada PDF oluşturma kütüphanesi kullanılmalıdır
    toast.error("Bu özellik henüz geliştirilme aşamasındadır");
  };

  /**
   * Planı görüntülemeye götürür.
   *
   * DÜZELTİLEN HATA: bu buton eskiden hiçbir şey yapmadan
   * "Plan kaydedildi!" mesajı gösteriyordu. Plan zaten üretilir üretilmez
   * sunucuda kaydediliyor; buton artık kullanıcıyı kaydedilmiş plana
   * yönlendiriyor.
   */
  const handleSavePlan = () => {
    const planId = tripPlan?.plan?.tripPlanId;

    if (!planId) {
      toast.error("Plan kaydedilemedi; lütfen tekrar oluşturmayı deneyin");
      return;
    }

    router.push(`/plan-detail/${planId}`);
  };

  // Planı kopyala
  const handleCopyPlan = async () => {
    if (!tripPlan) return;
    
    try {
      await navigator.clipboard.writeText(tripPlan.plan.markdown);
      toast.success("Plan panoya kopyalandı!");
    } catch (error) {
      logger.warn("Plan panoya kopyalanamadı", error);
      toast.error("Plan kopyalanırken bir hata oluştu");
    }
  };

  // Planı paylaş
  const handleSharePlan = async () => {
    if (!tripPlan) return;
    
    const shareData = {
      title: `${tripPlan.plan.city} Seyahat Planı`,
      text: `${tripPlan.plan.city}${tripPlan.plan.country ? ', ' + tripPlan.plan.country : ''} için oluşturduğum seyahat planı`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Plan paylaşıldı!");
      } else {
        // Fallback: URL'yi kopyala
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Plan linki panoya kopyalandı!");
      }
    } catch (error) {
      logger.warn("Plan paylaşılamadı", error);
      toast.error("Plan paylaşılırken bir hata oluştu");
    }
  };

  /* Seçim listeleri: sabit veriler render dışında dursun. */
  const ULASIM = ["Uçak", "Otobüs", "Tren", "Araba", "Toplu Taşıma"];
  const ILGI_ALANLARI = [
    "Tarihi Yerler", "Müzeler", "Doğa", "Gastronomi", "Alışveriş",
    "Eğlence", "Plajlar", "Fotoğrafçılık", "Yerel Kültür",
  ];

  /**
   * Onay kutusu yerine ETİKET.
   *
   * Eskiden burada `form-checkbox` sınıflı ham `<input type=checkbox>` vardı.
   * O sınıf `@tailwindcss/forms` eklentisinden geliyor — bu projede kurulu
   * DEĞİL, yani hiçbir şey yapmıyordu ve kutular işletim sistemi
   * varsayılanıyla, paletin tamamen dışında görünüyordu. Artık gerçek bir
   * checkbox (klavye ve ekran okuyucu için) görünmez duruyor, görünen şey
   * seçilebilir bir etiket. `peer` ile seçili durum CSS'ten geliyor.
   */
  const SecimEtiketi = ({
    grup,
    deger,
  }: {
    grup: "transportation" | "interests";
    deger: string;
  }) => (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={formData[grup].includes(deger)}
        onChange={() => handleCheckboxChange(grup, deger)}
      />
      <span
        className={cx(
          "block select-none rounded-full border px-3.5 py-2 text-sm text-center transition-colors duration-150",
          "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg-muted)]",
          "hover:border-[var(--fg-subtle)] hover:text-[var(--fg)]",
          "peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent-soft)] peer-checked:text-[var(--accent)] peer-checked:font-medium",
          "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--bg)]"
        )}
      >
        {deger}
      </span>
    </label>
  );

  /** Form bölümü başlığı — belgedeki numaralı kısımlar. */
  const Bolum = ({
    sira,
    baslik,
    children,
  }: {
    sira: string;
    baslik: string;
    children: React.ReactNode;
  }) => (
    <fieldset className="border-0 p-0 m-0">
      <legend className="flex items-baseline gap-2.5 mb-4 w-full">
        <span className="lejant text-[var(--route)]">{sira}</span>
        <span className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
          {baslik}
        </span>
      </legend>
      {children}
    </fieldset>
  );

  return (
    <SayfaKabugu>
      <Toaster position="top-center" />

      {/* ------------------------------------------------------------------ */}
      {/* Üretim sırasında görünen katman                                     */}
      {/* ------------------------------------------------------------------ */}
      {isGenerating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--fg)]/45 backdrop-blur-sm px-4"
          role="status"
          aria-live="polite"
        >
          <div className="relative overflow-hidden max-w-md w-full rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-pop)]">
            <KonturDoku yogunluk={0.6} />
            <div className="relative">
              {/* Burada boş bir div duruyordu; gerçek bir gösterge yoktu. */}
              <span
                className="inline-block h-9 w-9 rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)] animate-spin"
                aria-hidden="true"
              />
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mt-5">
                Planınız hazırlanıyor
              </h2>
              <p className="text-[var(--fg-muted)] mt-2 leading-relaxed">
                {ilerlemeMetni || "Rotalar ve öneriler araştırılıyor…"}
              </p>
              <p className="text-sm text-[var(--fg-subtle)] mt-4 leading-relaxed">
                Bu işlem birkaç dakika sürebilir. Sekmeyi kapatsanız bile plan
                arka planda hazırlanmaya devam eder ve Planlarım&apos;da görünür.
              </p>
            </div>
          </div>
        </div>
      )}

      <SayfaBasi
        baslik="Yapay zekâ ile plan"
        aciklama="Şehri, tarihleri ve tercihlerinizi girin. Günlük program, öneriler ve kalem kalem bütçe taslak olarak gelsin — sonra her kalemi kendiniz düzenleyebilirsiniz."
        yan={
          <BagDugme href="/travel-mode" tur="ikincil">
            Mod değiştir
          </BagDugme>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Künye formu                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)]">
        <div className="p-6 md:p-8">
          <form className="space-y-9" onSubmit={handleSubmit}>
            <Bolum sira="01" baslik="Nereye">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* KALKIŞ ŞEHRİ (B6). Doldurulduğunda plan bütçesine
                    şehirlerarası ulaşım kalemi ekleniyor; boş bırakılırsa
                    plan eskisi gibi "şehirdesiniz" varsayımıyla üretiliyor.
                    Liste bir SEÇİM DEĞİL, otomatik tamamlama: yurt dışından
                    gelen kullanıcı kendi şehrini yazabilmeli. */}
                <Alan etiket="Kalkış şehri" htmlFor="originCity">
                  <input
                    type="text"
                    id="originCity"
                    list="kalkis-sehirleri"
                    className={GIRDI_SINIFI}
                    placeholder="Örn: İstanbul"
                    value={formData.originCity}
                    onChange={handleInputChange}
                  />
                  <datalist id="kalkis-sehirleri">
                    {SEHIRLER.map((sehir) => (
                      <option key={sehir.ad} value={sehir.ad} />
                    ))}
                  </datalist>
                </Alan>
                <Alan etiket="Gidilecek şehir" htmlFor="city" zorunlu>
                  <input
                    type="text"
                    id="city"
                    className={GIRDI_SINIFI}
                    placeholder="Örn: İstanbul"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                  />
                </Alan>
                <Alan etiket="Ülke" htmlFor="country">
                  <input
                    type="text"
                    id="country"
                    className={GIRDI_SINIFI}
                    placeholder="Örn: Türkiye"
                    value={formData.country}
                    onChange={handleInputChange}
                  />
                </Alan>
              </div>
            </Bolum>

            <Bolum sira="02" baslik="Ne zaman">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Alan etiket="Başlangıç tarihi" htmlFor="startDate">
                  <input
                    type="date"
                    id="startDate"
                    className={cx(GIRDI_SINIFI, "sayisal")}
                    value={formData.startDate}
                    min={today}
                    onChange={handleInputChange}
                  />
                </Alan>
                <Alan etiket="Bitiş tarihi" htmlFor="endDate">
                  <input
                    type="date"
                    id="endDate"
                    className={cx(GIRDI_SINIFI, "sayisal")}
                    value={formData.endDate}
                    min={formData.startDate || today}
                    onChange={handleInputChange}
                  />
                </Alan>
              </div>
            </Bolum>

            <Bolum sira="03" baslik="Nasıl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Alan etiket="Seyahat tarzı" htmlFor="travelStyle">
                  <select
                    id="travelStyle"
                    className={GIRDI_SINIFI}
                    value={formData.travelStyle}
                    onChange={handleInputChange}
                  >
                    <option value="Standart">Standart</option>
                    <option value="Lüks">Lüks</option>
                    <option value="Ekonomik">Ekonomik</option>
                    <option value="Macera">Macera</option>
                    <option value="Kültürel">Kültürel</option>
                  </select>
                </Alan>
                <Alan etiket="Bütçe" htmlFor="budget">
                  <select
                    id="budget"
                    className={GIRDI_SINIFI}
                    value={formData.budget}
                    onChange={handleInputChange}
                  >
                    <option value="Ekonomik">Ekonomik</option>
                    <option value="Orta">Orta</option>
                    <option value="Lüks">Lüks</option>
                    <option value="Sınırsız">Sınırsız</option>
                  </select>
                </Alan>
                <Alan etiket="Konaklama tercihi" htmlFor="accommodation">
                  <select
                    id="accommodation"
                    className={GIRDI_SINIFI}
                    value={formData.accommodation}
                    onChange={handleInputChange}
                  >
                    <option value="Otel">Otel</option>
                    <option value="Hostel">Hostel</option>
                    <option value="Apart">Apart</option>
                    <option value="Airbnb">Airbnb</option>
                    <option value="Lüks Otel">Lüks Otel</option>
                  </select>
                </Alan>
              </div>
            </Bolum>

            <Bolum sira="04" baslik="Ulaşım">
              <div className="flex flex-wrap gap-2.5">
                {ULASIM.map((item) => (
                  <SecimEtiketi key={item} grup="transportation" deger={item} />
                ))}
              </div>
            </Bolum>

            <Bolum sira="05" baslik="İlgi alanları">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ILGI_ALANLARI.map((item) => (
                  <SecimEtiketi key={item} grup="interests" deger={item} />
                ))}
              </div>
            </Bolum>

            <Bolum sira="06" baslik="Notlar">
              <Alan
                etiket="Özel gereksinimler"
                htmlFor="specialRequirements"
                ipucu="Erişilebilirlik, beslenme, çocuklu seyahat — plan bunları dikkate alır."
              >
                <textarea
                  id="specialRequirements"
                  rows={3}
                  className={GIRDI_SINIFI}
                  placeholder="Seyahatinizle ilgili özel gereksinimler veya notlar…"
                  value={formData.specialRequirements}
                  onChange={handleInputChange}
                />
              </Alan>
            </Bolum>

            {/* Koçan: formun bittiği, eylemin başladığı yer. */}
            <Kocan />

            <div className="flex justify-end">
              <Dugme type="submit" boy="lg" bekliyor={isGenerating}>
                Planımı oluştur
                <Ikon.Sag className="h-4 w-4" />
              </Dugme>
            </div>
          </form>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sonuç: üretilmiş plan belgesi                                       */}
      {/* ------------------------------------------------------------------ */}
      {tripPlan && (
        <div id="trip-plan-result" className="space-y-6 mt-10">
          {/* Belge başlığı.
              DÜZELTİLEN GÖRÜNMEZ METİN HATASI: ülke, tarih, süre ve üretim
              zamanı `text-[var(--accent)]` ile yazılmıştı ama zemin de
              `bg-[var(--accent)]` idi — metin kendi zeminiyle AYNI renkti ve
              hiç okunmuyordu. Renkli zeminde ikincil metin artık zeminin
              kendi kontrast renginden açılıyor, griden değil. */}
          <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--accent)] text-[var(--accent-contrast)] p-6 md:p-8">
            <div
              className="pointer-events-none absolute inset-0 [--kontur:rgba(255,255,255,0.16)]"
              aria-hidden="true"
            >
              <KonturDoku />
            </div>

            <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="min-w-0">
                {/* "Hazırlanan plan" üst başlığı kaldırıldı: damga zaten
                    planın hazır olduğunu söylüyor, başlık da şehri. */}
                <h2 className="font-[family-name:var(--font-serif)] text-3xl leading-tight">
                  {tripPlan.plan.city}
                  {tripPlan.plan.country && (
                    <span className="text-[var(--accent-contrast)]/75">
                      {" · "}
                      {tripPlan.plan.country}
                    </span>
                  )}
                </h2>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[var(--accent-contrast)]/85">
                  {tripPlan.plan.startDate && tripPlan.plan.endDate && (
                    <span className="sayisal">
                      {new Date(tripPlan.plan.startDate).toLocaleDateString("tr-TR")}
                      {" – "}
                      {new Date(tripPlan.plan.endDate).toLocaleDateString("tr-TR")}
                    </span>
                  )}
                  {tripPlan.plan.duration && <span>{tripPlan.plan.duration}</span>}
                </div>

                {tripPlan.plan.metadata && (
                  <p className="text-sm text-[var(--accent-contrast)]/70 mt-3 sayisal">
                    {new Date(tripPlan.plan.metadata.generatedAt).toLocaleString("tr-TR")}
                    {" tarihinde oluşturuldu"}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-start md:items-end gap-5 shrink-0">
                {/* Damga tam da burada hak ediliyor: tek bir plan, tek bir
                    hüküm. Listelerde rozet, belgede damga. */}
                <Damga
                  ton="notr"
                  className="text-[var(--accent-contrast)] border-[var(--accent-contrast)]"
                >
                  Hazır
                </Damga>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleSavePlan}
                    className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--accent-contrast)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-contrast)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--accent)]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Planı kaydet
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--accent-contrast)]/35 px-4 py-2.5 text-sm font-medium text-[var(--accent-contrast)] transition-colors duration-150 hover:bg-[var(--accent-contrast)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-contrast)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--accent)]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF indir
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Plan gövdesi */}
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)]">
            <div className="p-6 md:p-8">

              {/* API sanitize ediyor; burada da geçiriyoruz — eski
                  kayıtlar sanitize edilmeden kaydedilmiş olabilir. */}
              <div
                className="plan-govde"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(tripPlan.plan.html) }}
              />
            </div>

            {/* Künye */}
            <div className="border-t border-[var(--line)] bg-[var(--surface-2)] px-6 py-4 md:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-sm text-[var(--fg-muted)]">
                  <Ikon.Uyari className="h-4 w-4 shrink-0 mt-0.5" />
                  Bu plan yapay zekâ tarafından oluşturuldu. Fiyatları ve açılış
                  saatlerini yola çıkmadan önce doğrulayın.
                </p>

                {tripPlan.plan.metadata?.model && (
                  <div className="shrink-0 text-xs text-[var(--fg-subtle)] space-y-1 sm:text-right">
                    <div>
                      <span className="lejant">Model</span>{" "}
                      <span className="font-[family-name:var(--font-geist-mono)]">
                        {tripPlan.plan.metadata.model}
                      </span>
                    </div>
                    {tripPlan.plan.metadata.savedToDatabase && (
                      <div className="text-[var(--ok)]">Kaydedildi</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hızlı işlemler */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-kart)]">
            <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
              Bu planla ne yapmak istersiniz?
            </h3>
            {/* Dört farklı renkte dört düğme vardı (mavi, yeşil, mor,
                kırmızı) — hepsi aynı ağırlıkta eylemler olmasına rağmen
                "bunlar farklı türde şeyler" diyordu. Yalnızca planı ekrandan
                kaldıran eylem ayrı tonda. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
              <Dugme tur="ikincil" onClick={handleSharePlan}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                Paylaş
              </Dugme>

              <Dugme tur="ikincil" onClick={handleCopyPlan}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Kopyala
              </Dugme>

              <Dugme tur="ikincil" onClick={() => window.print()}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Yazdır
              </Dugme>

              <Dugme tur="rota" onClick={() => setTripPlan(null)}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Yeni plan
              </Dugme>
            </div>
          </div>
        </div>
      )}
    </SayfaKabugu>
  );
}
