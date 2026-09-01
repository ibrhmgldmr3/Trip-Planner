"use client";

import Link from "next/link";
import { useState, FormEvent, ChangeEvent, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast, Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitize";
import { logger } from "@/lib/logger";
import {
  GirisGerekli,
  SayfaKabugu,
  Yukleniyor,
} from "@/components/ui";

interface TripFormData {
  city: string;
  country: string;
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

  return (
    <main className="min-h-screen p-4 md:p-8 bg-[var(--bg)] relative">
      <Toaster position="top-center" />
      
      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-[var(--surface)] p-8 rounded-[var(--radius-lg)] border border-[var(--line)] max-w-md mx-4 text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-2 bg-[var(--info-soft)] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-[var(--fg-muted)] mb-2">
              Seyahat Planınız Hazırlanıyor
            </h3>
            <p className="text-[var(--fg-muted)] mb-4">
              {ilerlemeMetni || "AI en iyi rotaları ve önerileri sizin için araştırıyor..."}
            </p>
            <p className="text-xs text-[var(--fg-subtle)] dark:text-[var(--fg-subtle)] mb-4">
              Bu işlem birkaç dakika sürebilir. Sekmeyi kapatsanız bile plan
              arka planda hazırlanmaya devam eder ve Planlarım&apos;da görünür.
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-[var(--fg-subtle)]">
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto text-[var(--fg-muted)]">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--fg)]">
              Seyahat Planlaması
            </h1>
            <p className="text-[var(--fg)] dark:text-[var(--fg-muted)] mt-2 max-w-2xl">
              Tarihinizi, bütçenizi ve tercihlerinizi belirleyerek kişiselleştirilmiş seyahat planınızı oluşturun.
            </p>
          </div>
          <Link 
            href="/"
            className="mt-4 md:mt-0 px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors self-start"
          >
            Ana Sayfaya Dön
          </Link>
        </div>

        {/* Form Section */}
        <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--line)] mb-8">
          <h2 className="text-xl font-semibold mb-6 text-[var(--accent)]">Seyahat Bilgileriniz</h2>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Destination */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-[var(--accent)] mb-1">Gidilecek Şehir</label>
                <input 
                  type="text" 
                  id="city" 
                  className="w-full px-4 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--surface)] text-[var(--fg-muted)]" 
                  placeholder="Örn: İstanbul"
                  value={formData.city}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-[var(--accent)] mb-1">Ülke</label>
                <input 
                  type="text" 
                  id="country" 
                  className="w-full px-4 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--surface)] text-[var(--fg-muted)]" 
                  placeholder="Örn: Türkiye"
                  value={formData.country}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-[var(--accent)] mb-1">Başlangıç Tarihi</label>
                <input 
                  type="date" 
                  id="startDate" 
                  className="w-full px-4 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--surface)] text-[var(--fg-muted)]" 
                  value={formData.startDate}
                  min={today}
                  onChange={handleInputChange}
                />
              </div>
              
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-[var(--accent)] mb-1">Bitiş Tarihi</label>
                <input 
                  type="date" 
                  id="endDate" 
                  className="w-full px-4 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--surface)] text-[var(--fg-muted)]" 
                  value={formData.endDate}
                  min={formData.startDate || today}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Travel Style & Budget */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="travelStyle" className="block text-sm font-medium text-[var(--accent)] mb-1">Seyahat Tarzı</label>
                <select
                  id="travelStyle"
                  className="w-full px-4 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--surface)] text-[var(--fg-muted)]"
                  value={formData.travelStyle}
                  onChange={handleInputChange}
                >
                  <option value="Standart">Standart</option>
                  <option value="Lüks">Lüks</option>
                  <option value="Ekonomik">Ekonomik</option>
                  <option value="Macera">Macera</option>
                  <option value="Kültürel">Kültürel</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="budget" className="block text-sm font-medium text-[var(--accent)] mb-1">Bütçe</label>
                <select
                  id="budget"
                  className="w-full px-4 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--surface)] text-[var(--fg-muted)]"
                  value={formData.budget}
                  onChange={handleInputChange}
                >
                  <option value="Ekonomik">Ekonomik</option>
                  <option value="Orta">Orta</option>
                  <option value="Lüks">Lüks</option>
                  <option value="Sınırsız">Sınırsız</option>
                </select>
              </div>
            </div>

            {/* Accommodation & Transportation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="accommodation" className="block text-sm font-medium text-[var(--accent)] mb-1">Konaklama Tercihi</label>
                <select
                  id="accommodation"
                  className="w-full px-4 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--surface)] text-[var(--fg-muted)]"
                  value={formData.accommodation}
                  onChange={handleInputChange}
                >
                  <option value="Otel">Otel</option>
                  <option value="Hostel">Hostel</option>
                  <option value="Apart">Apart</option>
                  <option value="Airbnb">Airbnb</option>
                  <option value="Lüks Otel">Lüks Otel</option>
                </select>
              </div>
              
              <div>
                <span className="block text-sm font-medium text-[var(--accent)] mb-2">Ulaşım Tercihleri</span>
                <div className="flex flex-wrap gap-4">
                  {["Uçak", "Otobüs", "Tren", "Araba", "Toplu Taşıma"].map((item) => (
                    <label key={item} className="inline-flex items-center">
                      <input 
                        type="checkbox" 
                        className="form-checkbox text-[var(--accent)] dark:bg-[var(--surface-2)] dark:border-[var(--line-strong)]"
                        checked={formData.transportation.includes(item)}
                        onChange={() => handleCheckboxChange("transportation", item)}
                      />
                      <span className="ml-2 text-[var(--fg)] dark:text-[var(--fg-muted)]">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Interests */}
            <div>
              <span className="block text-sm font-medium text-[var(--accent)] mb-2">İlgi Alanları</span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {["Tarihi Yerler", "Müzeler", "Doğa", "Gastronomi", "Alışveriş", "Eğlence", "Plajlar", "Fotoğrafçılık", "Yerel Kültür"].map((item) => (
                  <label key={item} className="inline-flex items-center">
                    <input 
                      type="checkbox" 
                      className="form-checkbox text-[var(--accent)] dark:bg-[var(--surface-2)] dark:border-[var(--line-strong)]"
                      checked={formData.interests.includes(item)}
                      onChange={() => handleCheckboxChange("interests", item)}
                    />
                    <span className="ml-2 text-[var(--fg)] dark:text-[var(--fg-muted)]">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Special Requirements */}
            <div>
              <label htmlFor="specialRequirements" className="block text-sm font-medium text-[var(--accent)] mb-1">Özel Gereksinimler</label>
              <textarea 
                id="specialRequirements" 
                rows={3}
                className="w-full px-4 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--surface)] text-[var(--fg-muted)]" 
                placeholder="Seyahatinizle ilgili özel gereksinimler veya notlar..."
                value={formData.specialRequirements}
                onChange={handleInputChange}
              ></textarea>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={isGenerating}
                className="px-8 py-4 bg-[var(--accent)] text-white rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--accent-hover)] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isGenerating ? (
                  <>
                    <div className="relative mr-3">
                    </div>
                    <span className="animate-pulse">AI Seyahat Planınızı oluşturuyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                     AI ile Kişisel Planımı oluştur
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        {/* AI Seyahat Planı Sonucu */}
        {tripPlan && (
          <div id="trip-plan-result" className="space-y-6">
            {/* Plan Header Card */}
            <div className="bg-[var(--accent)] text-white p-6 rounded-[var(--radius-lg)] border border-[var(--line)]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-start space-x-4">
                  <div className="bg-white/20 p-3 rounded-lg">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                       {tripPlan.plan.city}
                      {tripPlan.plan.country && <span className="text-[var(--accent)]"> · {tripPlan.plan.country}</span>}
                    </h2>
                    {tripPlan.plan.startDate && tripPlan.plan.endDate && (
                      <p className="text-[var(--accent)] mb-1">
                        {new Date(tripPlan.plan.startDate).toLocaleDateString('tr-TR')} - {new Date(tripPlan.plan.endDate).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                    {tripPlan.plan.duration && (
                      <p className="text-[var(--accent)]"> {tripPlan.plan.duration}</p>
                    )}
                    {tripPlan.plan.metadata && (
                      <p className="text-[var(--accent)] text-sm mt-2">
                         {new Date(tripPlan.plan.metadata.generatedAt).toLocaleString('tr-TR')} tarihinde oluşturuldu
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0">
                  <button
                    onClick={handleSavePlan}
                    className="px-4 py-2 bg-white text-[var(--accent)] rounded-lg text-sm font-medium hover:bg-blue-50 transition flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Planı Kaydet
                  </button>
                  
                  <button
                    onClick={handleDownloadPDF}
                    className="px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm font-medium hover:bg-white/20 transition flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF İndir
                  </button>
                </div>
              </div>
            </div>

            {/* Plan Content Card */}
            <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] overflow-hidden">
              <div className="p-6">
                <div className="prose prose-lg prose-blue dark:prose-invert max-w-none">
                  <style jsx global>{`
                    .prose h1 {
                      color: #1e40af;
                      border-bottom: 3px solid #3b82f6;
                      padding-bottom: 0.5rem;
                      margin-bottom: 1.5rem;
                      font-size: 2rem;
                      font-weight: 800;
                    }
                    .prose h2 {
                      color: var(--fg);
                      font-family: var(--font-serif);
                      padding-bottom: 0.5rem;
                      border-bottom: 1px solid var(--line);
                      margin: 2.5rem 0 1rem 0;
                      font-size: 1.5rem;
                      font-weight: 600;
                    }
                    .prose h3 {
                      color: #1e40af;
                      font-size: 1.25rem;
                      font-weight: 600;
                      margin: 1.5rem 0 0.75rem 0;
                      display: flex;
                      align-items: center;
                    }
                    .prose h3:before {
                      content: "•";
                      margin-right: 0.5rem;
                    }
                    .prose ul {
                      background: #f8fafc;
                      border-radius: 0.5rem;
                      padding: 1rem 1.5rem;
                      border: 1px solid #e2e8f0;
                      margin: 1rem 0;
                    }
                    .prose li {
                      margin: 0.5rem 0;
                      position: relative;
                      padding-left: 1rem;
                    }
                    .prose li:before {
                      content: "•";
                      position: absolute;
                      left: 0;
                      top: 0;
                    }
                    .prose ol {
                      background: #fefce8;
                      border-radius: 0.5rem;
                      padding: 1rem 1.5rem;
                      border: 1px solid #fde047;
                      margin: 1rem 0;
                    }
                    .prose ol li:before {
                      content: "";
                    }
                    .prose p {
                      line-height: 1.7;
                      margin: 1rem 0;
                      color: #374151;
                    }
                    .prose strong {
                      color: #1e40af;
                      font-weight: 600;
                    }
                    .prose em {
                      color: #059669;
                      font-style: normal;
                      font-weight: 500;
                    }
                    .prose blockquote {
                      background: var(--surface-2);
                      border-left: 1px solid var(--accent);
                      padding: 0.75rem 1.25rem;
                      margin: 1.5rem 0;
                      border-radius: 0 var(--radius) var(--radius) 0;
                      font-style: normal;
                    }
                    .prose blockquote p {
                      color: #065f46;
                      margin: 0;
                    }
                    .prose table {
                      width: 100%;
                      margin: 2rem 0;
                      background: white;
                      border-radius: 1rem;
                      overflow: hidden;
                      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                      border: 1px solid #e5e7eb;
                      border-collapse: separate;
                      border-spacing: 0;
                    }
                    .prose thead {
                      background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
                      position: relative;
                    }
                    .prose thead::after {
                      content: '';
                      position: absolute;
                      bottom: 0;
                      left: 0;
                      right: 0;
                      height: 2px;
                      background: linear-gradient(90deg, #60a5fa, #3b82f6, #1e40af);
                    }
                    .prose th {
                      background: transparent;
                      color: white;
                      font-weight: 700;
                      padding: 1.25rem 1.5rem;
                      text-align: left;
                      font-size: 0.95rem;
                      letter-spacing: 0.025em;
                      text-transform: uppercase;
                      border: none;
                      position: relative;
                    }
                    .prose th:first-child {
                      border-top-left-radius: 1rem;
                    }
                    .prose th:last-child {
                      border-top-right-radius: 1rem;
                    }
                    .prose th::before {
                      content: '';
                      position: absolute;
                      top: 50%;
                      left: 0;
                      transform: translateY(-50%);
                      width: 1px;
                      height: 60%;
                      background: rgba(255, 255, 255, 0.2);
                    }
                    .prose th:first-child::before {
                      display: none;
                    }
                    .prose tbody {
                      background: white;
                    }
                    .prose tbody tr {
                      transition: all 0.2s ease;
                      border-bottom: 1px solid #f1f5f9;
                    }
                    .prose tbody tr:last-child {
                      border-bottom: none;
                    }
                    .prose tbody tr:nth-child(even) {
                      background: #f8fafc;
                    }
                    .prose tbody tr:hover {
                      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                      transform: translateY(-1px);
                      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
                    }
                    .prose td {
                      padding: 1rem 1.5rem;
                      border: none;
                      font-size: 0.925rem;
                      color: #374151;
                      line-height: 1.6;
                      vertical-align: top;
                      position: relative;
                    }
                    .prose td:first-child {
                      font-weight: 600;
                      color: #1e40af;
                      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                      border-right: 2px solid #bfdbfe;
                    }
                    .prose td strong {
                      color: #1e40af;
                      font-weight: 700;
                    }
                    .prose td em {
                      color: #059669;
                      font-style: normal;
                      background: #d1fae5;
                      padding: 0.125rem 0.25rem;
                      border-radius: 0.25rem;
                      font-size: 0.875rem;
                    }
                    /* Tablo içinde liste stilleri */
                    .prose table ul, .prose table ol {
                      margin: 0.5rem 0;
                      padding-left: 1rem;
                      background: transparent;
                      border: none;
                    }
                    .prose table li {
                      margin: 0.25rem 0;
                      padding: 0;
                      font-size: 0.875rem;
                    }
                    .prose table li:before {
                      content: "•";
                      color: #3b82f6;
                      font-weight: bold;
                      margin-right: 0.5rem;
                    }
                    /* Responsive tablo */
                    @media (max-width: 768px) {
                      .prose table {
                        font-size: 0.875rem;
                        margin: 1.5rem 0;
                      }
                      .prose th, .prose td {
                        padding: 0.75rem 1rem;
                      }
                      .prose th {
                        font-size: 0.8rem;
                      }
                    }
                    /* Tablo başlık ikonları */
                    .prose th:nth-child(1)::after { content: " "; }
                    .prose th:nth-child(2)::after { content: " "; }
                    .prose th:nth-child(3)::after { content: " "; }
                    .prose th:nth-child(4)::after { content: " ?"; }
                    .prose th:nth-child(5)::after { content: " "; }
                    
                    /* Dark mode styles */
                    .dark .prose h2 {
                      color: #60a5fa;
                      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
                    }
                    .dark .prose ul {
                      background: #374151;
                      border-color: #4b5563;
                    }
                    .dark .prose ol {
                      background: #422006;
                      border-color: #a16207;
                    }
                    .dark .prose p {
                      color: #d1d5db;
                    }
                    .dark .prose strong {
                      color: #60a5fa;
                    }
                    .dark .prose blockquote {
                      background: #064e3b;
                      border-color: #059669;
                    }
                    .dark .prose blockquote p {
                      color: #6ee7b7;
                    }
                    /* Dark mode tablo stilleri */
                    .dark .prose table {
                      background: #1f2937;
                      border-color: #374151;
                      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
                    }
                    .dark .prose thead {
                      background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
                    }
                    .dark .prose thead::after {
                      background: linear-gradient(90deg, #3b82f6, #1e40af, #1e3a8a);
                    }
                    .dark .prose th {
                      color: #f1f5f9;
                      border-color: #4b5563;
                    }
                    .dark .prose th::before {
                      background: rgba(255, 255, 255, 0.1);
                    }
                    .dark .prose tbody {
                      background: #1f2937;
                    }
                    .dark .prose tbody tr {
                      border-color: #374151;
                    }
                    .dark .prose tbody tr:nth-child(even) {
                      background: #111827;
                    }
                    .dark .prose tbody tr:hover {
                      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
                      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
                    }
                    .dark .prose td {
                      color: #d1d5db;
                      border-color: #374151;
                    }
                    .dark .prose td:first-child {
                      color: #60a5fa;
                      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
                      border-right-color: #3b82f6;
                    }
                    .dark .prose td strong {
                      color: #60a5fa;
                    }
                    .dark .prose td em {
                      color: #6ee7b7;
                      background: #064e3b;
                    }
                    .dark .prose table li:before {
                      color: #60a5fa;
                    }
                  `}</style>
                  {/* API sanitize ediyor; burada da geçiriyoruz — eski
                      kayıtlar sanitize edilmeden kaydedilmiş olabilir. */}
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(tripPlan.plan.html) }}></div>
                </div>
              </div>
              
              {/* Plan Footer */}
              <div className="bg-[var(--surface-2)] px-6 py-4 border-t border-[var(--line)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center text-sm text-[var(--fg-muted)]">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Bu plan AI tarafından oluşturulmuştur. Güncel bilgileri kontrol etmeyi unutmayın.</span>
                  </div>
                  {tripPlan.plan.metadata?.model && (
                    <div className="text-xs text-[var(--fg-subtle)] mt-2 sm:mt-0 space-y-1">
                      <div>Model: {tripPlan.plan.metadata.model}</div>
                      {tripPlan.plan.tripPlanId && (
                        <div className="flex items-center space-x-1">
                          <span> DB ID:</span>
                          <code className="bg-[var(--surface-2)] px-1 rounded text-xs">
                            {tripPlan.plan.tripPlanId}
                          </code>
                        </div>
                      )}
                      {tripPlan.plan.metadata.savedToDatabase && (
                        <div className="text-[var(--accent)]">
                          Veritabanında saklandı
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--line)]">
              <h3 className="text-lg font-semibold text-[var(--fg-muted)] mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Hızlı İşlemler
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button 
                  onClick={handleSharePlan}
                  className="flex items-center justify-center px-4 py-3 bg-blue-50 dark:bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg hover:bg-[var(--accent-soft)] dark:hover:bg-[var(--accent-soft)] transition"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  Paylaş
                </button>
                
                <button 
                  onClick={handleCopyPlan}
                  className="flex items-center justify-center px-4 py-3 bg-[var(--ok-soft)] text-[var(--ok)] rounded-lg hover:bg-[var(--ok-soft)] dark:hover:bg-[var(--ok-soft)] transition"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Kopyala
                </button>
                
                <button 
                  onClick={() => window.print()}
                  className="flex items-center justify-center px-4 py-3 bg-purple-50 dark:bg-[var(--surface-2)] text-[var(--fg)] dark:text-[var(--fg)] rounded-lg hover:bg-[var(--surface-2)] dark:hover:bg-[var(--surface-2)] transition"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Yazdır
                </button>
                
                <button 
                  onClick={() => setTripPlan(null)}
                  className="flex items-center justify-center px-4 py-3 bg-[var(--danger-soft)] text-[var(--danger)] rounded-lg hover:bg-[var(--danger-soft)] dark:hover:bg-[var(--danger-soft)] transition"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Yeni Plan
                </button>
              </div>
            </div>
          </div>
        )}

        
        
        {/* Sonuç Bölümü */}
        <div className="bg-[var(--bg)] p-6 rounded-[var(--radius-lg)] border border-[var(--line)] mb-8">
          <h2 className="text-xl font-semibold mb-4 text-[var(--accent)]">Sonuç</h2>
          <p className="text-[var(--fg)] dark:text-[var(--fg-muted)] font-medium mb-4">
            Bu sistem, yapay zeka destekli tatil planlama çözümleri arasında kullanıcı dostu, özelleştirilebilir ve ekonomik bir seçenek sunmayı hedeflemektedir. İlk etapta temel işlevler (şehir seçimi, mekan önerisi, rota, bütçe) geliştirilecek; sonraki aşamalarda çoklu şehir planlama, sosyal paylaşım, konaklama entegrasyonu gibi ek özellikler eklenebilir.
          </p>
        </div>
        
        <div className="mt-8 text-sm text-[var(--fg)] dark:text-[var(--fg-subtle)] text-center">
          &copy; {new Date().getFullYear()} Trip Planner - Tüm hakları saklıdır.
        </div>
      </div>
    </main>
  );
}


