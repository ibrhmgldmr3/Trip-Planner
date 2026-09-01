"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { logger } from "@/lib/logger";
import {
  BagDugme,
  BosDurum,
  Dugme,
  GIRDI_SINIFI,
  GirisGerekli,
  Kart,
  Rozet,
  SayfaBasi,
  cx,
} from "@/components/ui";
import { butceyiCoz, REZERV_ORANI, type PlanButcesi } from "@/lib/plan-budget";
import { gunSayisi } from "@/lib/trip-dates";
import { TripStatus, getStatusLabel, getStatusTone } from "@/lib/trip-status";

/**
 * Bütçe sayfası.
 *
 * DÜZELTİLEN MANTIK HATALARI:
 *
 *  1. ÇİFT SAYIM. Sayfa `total_cost` (planın toplam maliyeti) ile
 *     `butce_tahmini` içindeki kalemleri TOPLUYORDU. Oysa o kalemler zaten
 *     `total_cost`u oluşturan kalemler; her plan iki katı maliyetle
 *     görünüyordu. Artık tek gerçek kaynak kalem listesi.
 *  2. ÖDEME DURUMU KAYBI. Kalemler yüklenirken `isPaid: false` sabit
 *     yazılıyordu; "Ödendi" işareti kaydediliyor ama bir daha hiç
 *     okunmuyordu. Artık `butceyiCoz` üzerinden korunuyor.
 *  3. DURUM ETİKETİ. Rozet `'PLANLANDI' / 'AKTIF' / 'TAMAMLANDI'` metinleriyle
 *     karşılaştırılıyordu; API `PLANNED / ACTIVE / COMPLETED` döndürüyor.
 *     Hiçbiri eşleşmediği için HER plan kırmızı "iptal" rengiyle ve ham
 *     İngilizce değerle görünüyordu.
 *  4. REZERV KATSAYISI. Burada 1.25, sunucu serileştiricisinde 1.20
 *     kullanılıyordu; aynı plan iki ekranda farklı "önerilen bütçe"
 *     gösteriyordu. Katsayı artık plan-budget.ts'ten geliyor.
 *  5. `duration` alanı `number` ilan edilmişti; API `"5 gün"` METNİ
 *     döndürüyor, dolayısıyla `duration > 0` daima false'tu. Gün sayısı
 *     artık tarihlerden, paylaşılan yardımcıyla hesaplanıyor.
 *  6. KİŞİ SAYISI ÇARPANI. `travelers` API'de hiç dönmüyor, her zaman 1'di;
 *     kategoriye göre çarpma yapan ölü kod kaldırıldı.
 */

interface BudgetItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date?: string;
  isEstimate: boolean;
  isPaid: boolean;
  paymentMethod?: string;
  /**
   * Tutarın dayandığı harici kaynak (agentic üretimde arama sonucunun
   * URL'i). Elle eklenen kalemlerde tanımsız. Doğrulaması sunucuda
   * (`guvenliKaynakUrl`) yapılıyor; buraya yalnızca http/https geliyor.
   */
  source?: string;
}

interface Trip {
  id: string;
  city: string;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  total_cost?: number | null;
  budget_level?: string | null;
  travel_style?: string | null;
  /** API `"5 gün"` biçiminde METİN döndürüyor; sayı değil. */
  duration?: string | null;
  status?: string | null;
}

/** Iki tarihi kullaniciya gosterilecek araliga cevirir; null'a dayanikli. */
function tarihAraligi(start: string | null | undefined, end: string | null | undefined): string {
  const coz = (v: string | null | undefined) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const bas = coz(start);
  const bit = coz(end);

  if (!bas && !bit) return 'Tarih belirtilmemiş';
  if (bas && bit) return `${bas.toLocaleDateString('tr-TR')} - ${bit.toLocaleDateString('tr-TR')}`;
  return (bas ?? bit)!.toLocaleDateString('tr-TR');
}

export default function BudgetPage() {
  const { status } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [originalBudgetItems, setOriginalBudgetItems] = useState<BudgetItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state for new budget item
  const [newItem, setNewItem] = useState({
    category: 'ulaşım',
    description: '',
    amount: 0,
    currency: 'TRY',
    isEstimate: true,
    isPaid: false,
    paymentMethod: ''
  });

  // Plan düzenlenebilirlik kontrolü
  const isPlanEditable = (trip: Trip | null) => {
    if (!trip) return false;

    // Sadece "Planlandı" durumundaki planlar düzenlenebilir.
    if (trip.status !== TripStatus.PLANNED) return false;

    // Tarihi olmayan bir plan gelecek sayılır: yola çıkılmamış demektir.
    // (Eskiden `new Date(null)` 1970 üretip planı kilitliyordu.)
    if (!trip.startDate) return true;

    const startDate = new Date(trip.startDate);
    if (Number.isNaN(startDate.getTime())) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    // Plan başlangıç tarihi bugün veya gelecekte ise düzenlenebilir
    return startDate >= today;
  };

  // Değişiklikleri kaydetme fonksiyonu
  const saveChanges = async () => {
    if (!selectedTrip || !isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenebilir değil');
      return;
    }

    try {
      const guncel = await updateTripCosts(selectedTrip.id, budgetItems);

      // Sunucunun hesapladığı toplamı listeye de yansıt; aksi halde gezi
      // kartındaki tutar kaydettikten sonra eski değerde kalıyordu.
      if (guncel?.total_cost !== undefined) {
        setSelectedTrip((onceki) =>
          onceki ? { ...onceki, total_cost: guncel.total_cost } : onceki
        );
        setTrips((onceki) =>
          onceki.map((trip) =>
            trip.id === selectedTrip.id ? { ...trip, total_cost: guncel.total_cost } : trip
          )
        );
      }

      setOriginalBudgetItems([...budgetItems]);
      setHasChanges(false);
      toast.success('Değişiklikler kaydedildi');
    } catch (error) {
      logger.error("Bütçe kaydedilemedi", error);
      toast.error(error instanceof Error ? error.message : 'Değişiklikler kaydedilemedi');
    }
  };

  /**
   * Kalem listesini sunucuya yazar.
   *
   * Toplam/önerilen bütçe/günlük ortalama BURADA hesaplanmıyor: sunucu
   * (`PATCH /api/plan-detail/[id]`) kategori toplamlarından yeniden
   * hesaplayıp `total_cost` ve `daily_cost` sütunlarıyla birlikte
   * kaydediyor. Böylece iki taraf birbirinden ayrışamıyor.
   */
  const updateTripCosts = async (tripId: string, items: BudgetItem[]) => {
    const categories = items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = { items: [], total: 0 };
      }
      acc[item.category].items.push({
        description: item.description,
        amount: item.amount,
        // Ödeme durumu artık kaydedilip GERİ DE OKUNUYOR.
        isPaid: item.isPaid,
        // Kaynak da geri yazılıyor: aksi halde kullanıcının bir kalemi
        // "ödendi" işaretlemesi, AI'ın bulduğu kaynağı sessizce silerdi.
        ...(item.source ? { source: item.source } : {}),
      });
      acc[item.category].total += item.amount;
      return acc;
    }, {} as Record<string, { items: Array<{ description: string; amount: number; isPaid: boolean; source?: string }>; total: number }>);

    const response = await fetch(`/api/plan-detail/${tripId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        butce_tahmini: JSON.stringify({ categories, currency: 'TRY' }),
      }),
    });

    if (!response.ok) {
      const hata = await response.json().catch(() => null);
      throw new Error(hata?.error || 'Plan güncellenemedi');
    }

    const data = await response.json();
    return data?.plan as { total_cost?: number; daily_cost?: number } | undefined;
  };

  
  // Değişiklikleri iptal etme fonksiyonu
  const cancelChanges = () => {
    setBudgetItems([...originalBudgetItems]);
    setHasChanges(false);
    setShowAddForm(false);
    toast.success('Değişiklikler iptal edildi');
  };

  // Markdown formatındaki bütçe verisini parse eden fonksiyon
  /**
   * Markdown biçimindeki eski bütçe metninden kalem çıkarır.
   *
   * Yalnızca `butce_tahmini` JSON DEĞİLSE devreye giriyor (yapılandırılmış
   * çıktıdan önce üretilmiş planlar). Bilinçli olarak kaba: amaç tahmini
   * bir döküm göstermek, tam doğruluk değil.
   */
  const parseMarkdownBudget = useCallback((markdownText: string): BudgetItem[] => {
    const items: BudgetItem[] = [];
    const priceRegex = /(\d+(?:[.,]\d+)?)\s*(?:TL|₺|TRY)/gi;
    const lines = markdownText.split('\n');

    let currentCategory = 'diğer';

    lines.forEach((line, index) => {
      const lower = line.toLowerCase();

      // Kategori başlığı satırı
      if (lower.includes('ulaşım')) currentCategory = 'ulaşım';
      else if (lower.includes('konaklama')) currentCategory = 'konaklama';
      else if (lower.includes('yemek')) currentCategory = 'yemek';
      else if (lower.includes('aktivite')) currentCategory = 'aktiviteler';

      priceRegex.lastIndex = 0;
      const eslesme = priceRegex.exec(line);
      if (!eslesme) return;

      const amount = Number.parseFloat(eslesme[1].replace(',', '.'));
      if (!Number.isFinite(amount) || amount <= 0) return;

      const description = line
        .replace(priceRegex, '')
        .replace(/[*#>-]/g, '')
        .trim();

      items.push({
        id: `md-${index}`,
        category: currentCategory,
        description: description || 'Açıklama yok',
        amount: Math.round(amount),
        currency: 'TRY',
        isEstimate: true,
        isPaid: false,
      });
    });

    return items;
  }, []);

  /**
   * `butce_tahmini` sütununu ekranda gösterilecek kalem listesine çevirir.
   *
   * Önce paylaşılan çözücü (`butceyiCoz`) deneniyor; o `null` dönerse
   * içerik markdown demektir ve eski ayrıştırıcıya düşülüyor.
   *
   * Eskiden bu mantık sayfada İKİ KEZ, birebir kopyalanmış hâlde duruyordu
   * (ilk yükleme ve gezi değiştirme için ayrı ayrı) — biri düzeltilip
   * diğeri unutulduğunda ekranlar ayrışıyordu.
   */
  const kalemlereCevir = useCallback(
    (raw: string | null | undefined): BudgetItem[] => {
      if (!raw) return [];

      const butce: PlanButcesi | null = butceyiCoz(raw);

      if (!butce) return parseMarkdownBudget(raw);

      const items: BudgetItem[] = [];

      for (const [category, detay] of Object.entries(butce.categories)) {
        if (detay.items.length > 0) {
          detay.items.forEach((item, index) => {
            items.push({
              id: `${category}-${index}`,
              category,
              description: item.description,
              amount: item.amount,
              currency: butce.currency,
              isEstimate: true,
              // Ödeme durumu korunuyor; eskiden sabit false yazılıyordu.
              isPaid: item.isPaid,
              ...(item.source ? { source: item.source } : {}),
            });
          });
        } else if (detay.total > 0) {
          // Kalemi olmayan ama toplamı olan kategoriler (AI bazen böyle
          // veriyor) tek satır olarak gösteriliyor.
          items.push({
            id: `${category}-total`,
            category,
            description: `${category} toplam`,
            amount: detay.total,
            currency: butce.currency,
            isEstimate: true,
            isPaid: false,
          });
        }
      }

      return items;
    },
    [parseMarkdownBudget]
  );

  /** Seçili planın bütçe kalemlerini yükler. */
  const fetchBudgetItems = useCallback(
    async (tripId: string) => {
      if (!tripId) return;

      try {
        const response = await fetch(`/api/plan-detail/${tripId}`);
        if (!response.ok) throw new Error('Plan detayı yüklenemedi');

        const data = await response.json();
        const items = data?.success && data?.plan
          ? kalemlereCevir(data.plan.butce_tahmini)
          : [];

        setBudgetItems(items);
        setOriginalBudgetItems([...items]);
        setHasChanges(false);
      } catch (err) {
        logger.error("Bütçe yüklenemedi", err);
        setBudgetItems([]);
        setOriginalBudgetItems([]);
        setHasChanges(false);
      }
    },
    [kalemlereCevir]
  );

  const fetchUserTrips = useCallback(async () => {
    try {
      const response = await fetch('/api/my-plans');
      if (!response.ok) throw new Error('Planlar yüklenemedi');

      const data = await response.json();
      const gelen: Trip[] = Array.isArray(data?.plans) ? data.plans : [];

      setTrips(gelen);
      if (gelen.length > 0) setSelectedTrip(gelen[0]);
    } catch (err) {
      logger.error("Veriler yüklenemedi", err);
      setError('Geziler yüklenemedi');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      toast.error('Bu sayfayı görüntülemek için giriş yapmanız gerekiyor');
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      fetchUserTrips();
    }
  }, [status, router, fetchUserTrips]);

  // Seçili gezi değiştiğinde bütçeyi yeniden yükle. İlk gezi de buradan
  // yükleniyor; eskiden ayrıca fetchUserTrips içinden de çağrılıyor ve
  // aynı istek iki kez atılıyordu.
  useEffect(() => {
    if (!selectedTrip?.id) return;
    fetchBudgetItems(selectedTrip.id);
  }, [selectedTrip?.id, fetchBudgetItems]);

  const addBudgetItem = () => {
    if (!selectedTrip || !isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenebilir değil');
      return;
    }

    if (!newItem.description || newItem.amount <= 0) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }
    
    const newBudgetItem: BudgetItem = {
      id: Date.now().toString(),
      ...newItem
    };
    
    setBudgetItems([...budgetItems, newBudgetItem]);
    setHasChanges(true);
    setNewItem({
      category: 'ulaşım',
      description: '',
      amount: 0,
      currency: 'TRY',
      isEstimate: true,
      isPaid: false,
      paymentMethod: ''
    });
    setShowAddForm(false);
    toast.success('Maliyet kalemi eklendi');
  };

  const deleteBudgetItem = (itemId: string) => {
    if (!selectedTrip || !isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenebilir değil');
      return;
    }

    if (!confirm('Bu maliyet kalemini silmek istediğinizden emin misiniz?')) return;

    setBudgetItems(budgetItems.filter(item => item.id !== itemId));
    setHasChanges(true);
    toast.success('Maliyet kalemi silindi');
  };

  const togglePaidStatus = (itemId: string) => {
    if (!selectedTrip || !isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenebilir değil');
      return;
    }

    setBudgetItems(budgetItems.map(item => 
      item.id === itemId ? { ...item, isPaid: !item.isPaid } : item
    ));
    setHasChanges(true);
    toast.success('Ödeme durumu güncellendi');
  };

  /*
   * Hesaplamalar.
   *
   * TEK GERÇEK KAYNAK: kalem listesi. `selectedTrip.total_cost` bu kalemlerden
   * TÜRETİLMİŞ bir değer, ayrı bir maliyet değil — eskiden ikisi toplanıyor
   * ve her plan iki katı maliyetle görünüyordu.
   */
  const totalCost = budgetItems.reduce((sum, item) => sum + item.amount, 0);
  const suggestedBudget = Math.round(totalCost * REZERV_ORANI);

  // Ödenmiş/kalan ayrımı: "Ödendi" işareti artık kalıcı olduğu için
  // anlamlı bir özet üretilebiliyor.
  const paidTotal = budgetItems
    .filter((item) => item.isPaid)
    .reduce((sum, item) => sum + item.amount, 0);
  const remainingTotal = totalCost - paidTotal;

  // Gün sayısı KAPSAYICI (bkz. src/lib/trip-dates.ts). `duration` alanı
  // `"5 gün"` biçiminde metin olduğu için sayısal karşılaştırmaya girmiyor.
  const days = gunSayisi(selectedTrip?.startDate, selectedTrip?.endDate) || 1;
  const dailyCost = Math.round(totalCost / days);
  const dailySuggestedBudget = Math.round(suggestedBudget / days);

  // Kategori dağılımı
  const categoryTotals = budgetItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  // `categoryColors` KALDIRILDI: her kategoriye bir renk atayıp yanına
  // renkli bir nokta koymak hiçbir şey anlatmıyordu — kullanıcı hangi
  // rengin hangi kategori olduğunu bilmiyor, üstelik etiket zaten yanında
  // yazıyordu. Yerine kategori dağılımında oran çubuğu var.

  const categoryLabels: Record<string, string> = {
    'ulaşım': 'Ulaşım',
    'konaklama': 'Konaklama',
    'yemek': 'Yemek',
    'aktiviteler': 'Aktiviteler',
    'alışveriş': 'Alışveriş',
    'eğlence': 'Eğlence',
    'diğer': 'Diğer'
  };

  // Loading durumu
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-[var(--fg-muted)]">
            Bütçe verileri yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  // Giriş yapmamış kullanıcı
  if (status === 'unauthenticated') {
    return <GirisGerekli />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-16">
          <BosDurum
            baslik="Bütçe yüklenemedi"
            aciklama={error}
            eylem={<Dugme onClick={() => window.location.reload()}>Tekrar dene</Dugme>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
        <SayfaBasi
          baslik="Bütçe"
          aciklama="Seyahat harcamalarınızı kalem kalem planlayın ve yolda takip edin."
          yan={
            <div className="flex gap-2">
              <BagDugme href="/my-plans" tur="ikincil">
                Planlarım
              </BagDugme>
              <BagDugme href="/travel-mode">Yeni plan</BagDugme>
            </div>
          }
        />

        {/* Trip Selection */}
        {trips.length > 0 && (
          <section className="mb-8">
            <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-4">
              Hangi plan?
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => {
                    if (hasChanges) {
                      if (confirm('Kaydedilmemiş değişiklikleriniz var. Devam etmek istediğinizden emin misiniz?')) {
                        setSelectedTrip(trip);
                        setHasChanges(false);
                      }
                    } else {
                      setSelectedTrip(trip);
                    }
                  }}
                  className={cx(
                    "text-left p-4 rounded-[var(--radius-lg)] border transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                    selectedTrip?.id === trip.id
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]"
                  )}
                  aria-pressed={selectedTrip?.id === trip.id}
                >
                  <h3 className="font-medium text-[var(--fg)]">
                    {trip.city}
                    {trip.country && (
                      <span className="text-[var(--fg-muted)]">, {trip.country}</span>
                    )}
                  </h3>
                  <p className="text-sm text-[var(--fg-muted)] mt-0.5">
                    {tarihAraligi(trip.startDate, trip.endDate)}
                  </p>
                  {trip.total_cost && (
                    <p className="text-sm text-[var(--fg)] tabular-nums mt-1">
                      ₺{trip.total_cost.toLocaleString('tr-TR')}
                    </p>
                  )}
                  {trip.status && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {/* Rozet eskiden 'PLANLANDI'/'AKTIF'/'TAMAMLANDI' metinleriyle
                          karsilastiriliyordu; API 'PLANNED'/'ACTIVE'/... donuyor,
                          dolayisiyla her plan kirmizi ve Ingilizce gorunuyordu. */}
                      <Rozet ton={getStatusTone(trip.status)}>
                        {getStatusLabel(trip.status)}
                      </Rozet>
                      {!isPlanEditable(trip) && <Rozet ton="uyari">Salt okunur</Rozet>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {selectedTrip && (
          <>
            {/* Özet: yalnızca TOPLAM vurgulu. Üç sayıyı da büyük ve renkli
                yapmak hiçbirini öne çıkarmıyordu — vurgu her yerdeyse
                hiçbir yerde demektir. */}
            <div className="grid sm:grid-cols-3 gap-3 mb-8">
              <Kart className="p-5">
                <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">
                  Toplam maliyet
                </p>
                <p className="font-[family-name:var(--font-serif)] text-3xl text-[var(--accent)] tabular-nums mt-1">
                  ₺{totalCost.toLocaleString('tr-TR')}
                </p>
                <p className="text-sm text-[var(--fg-muted)] mt-2">
                  Günlük ₺{dailyCost.toLocaleString('tr-TR')} · {days} gün
                </p>
              </Kart>

              <Kart className="p-5">
                <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">
                  Önerilen bütçe
                </p>
                <p className="font-[family-name:var(--font-serif)] text-3xl text-[var(--fg)] tabular-nums mt-1">
                  ₺{suggestedBudget.toLocaleString('tr-TR')}
                </p>
                <p className="text-sm text-[var(--fg-muted)] mt-2">
                  %{Math.round((REZERV_ORANI - 1) * 100)} rezerv dahil · günlük ₺
                  {dailySuggestedBudget.toLocaleString('tr-TR')}
                </p>
              </Kart>

              <Kart className="p-5">
                <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">
                  Ödenen
                </p>
                <p className="font-[family-name:var(--font-serif)] text-3xl text-[var(--fg)] tabular-nums mt-1">
                  ₺{paidTotal.toLocaleString('tr-TR')}
                </p>
                <p className="text-sm text-[var(--fg-muted)] mt-2">
                  Kalan ₺{remainingTotal.toLocaleString('tr-TR')} · {budgetItems.length} kalem
                </p>
              </Kart>
            </div>



            {/* "Plan Temel Maliyeti" karti KALDIRILDI: gosterdigi tutar
                asagidaki kalemlerin toplamiyla ayni seydi ve toplam
                hesabinda ikinci kez ekleniyordu. */}

            {/* Kategori Dağılımı */}
            {Object.keys(categoryTotals).length > 0 && (
              <Kart className="mb-8">
                <div className="px-5 py-4 border-b border-[var(--line)]">
                  <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                    Kategori dağılımı
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  {Object.entries(categoryTotals).map(([category, amount]) => {
                    const yuzde = totalCost > 0 ? (amount / totalCost) * 100 : 0;
                    return (
                      <div key={category}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-[var(--fg)]">
                            {categoryLabels[category] || category}
                          </span>
                          <span className="text-[var(--fg-muted)] tabular-nums">
                            ₺{amount.toLocaleString('tr-TR')}
                            <span className="text-[var(--fg-subtle)] ml-2">
                              %{yuzde.toFixed(1)}
                            </span>
                          </span>
                        </div>
                        {/* Renkli nokta yerine oran çubuğu: nokta hiçbir bilgi
                            taşımıyordu, çubuk payı bir bakışta gösteriyor. */}
                        <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${Math.min(100, yuzde)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Kart>
            )}

            {/* Extra Items */}
            <Kart className="mb-8">
              {/* Metne düşmüş "?" karakterleri temizlendi: kaynakta emoji
                  yerine soru işareti kalmıştı ve arayüzde öyle görünüyordu. */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[var(--line)]">
                <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                  Maliyet kalemleri
                </h3>
                <div className="flex flex-wrap gap-2">
                  {hasChanges && isPlanEditable(selectedTrip) && (
                    <>
                      <Dugme boy="sm" onClick={saveChanges}>
                        Kaydet
                      </Dugme>
                      <Dugme boy="sm" tur="sessiz" onClick={cancelChanges}>
                        Vazgeç
                      </Dugme>
                    </>
                  )}
                  {isPlanEditable(selectedTrip) && (
                    <Dugme
                      boy="sm"
                      tur={hasChanges ? "ikincil" : "birincil"}
                      onClick={() => setShowAddForm(!showAddForm)}
                    >
                      {showAddForm ? 'Formu kapat' : 'Kalem ekle'}
                    </Dugme>
                  )}
                </div>
              </div>

              <div className="p-5">

              {/* Add Form */}
              {showAddForm && isPlanEditable(selectedTrip) && (
                <div className="bg-[var(--surface-2)] border border-[var(--line)] p-4 rounded-[var(--radius)] mb-5">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label
                        htmlFor="yeni-kalem-kategori"
                        className="block text-sm font-medium text-[var(--fg)] mb-1.5"
                      >
                        Kategori
                      </label>
                      <select
                        id="yeni-kalem-kategori"
                        value={newItem.category}
                        onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                        className={GIRDI_SINIFI}
                      >
                        <option value="ulaşım">Ulaşım</option>
                        <option value="konaklama">Konaklama</option>
                        <option value="yemek">Yemek</option>
                        <option value="aktiviteler">Aktiviteler</option>
                        <option value="alışveriş">Alışveriş</option>
                        <option value="eğlence">Eğlence</option>
                        <option value="diğer">Diğer</option>
                      </select>
                    </div>
                    
                    <div>
                      <label
                        htmlFor="yeni-kalem-aciklama"
                        className="block text-sm font-medium text-[var(--fg)] mb-1.5"
                      >
                        Açıklama
                      </label>
                      <input
                        id="yeni-kalem-aciklama"
                        type="text"
                        value={newItem.description}
                        onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                        className={GIRDI_SINIFI}
                        placeholder="Örn. Havaalanı transferi"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="yeni-kalem-tutar"
                        className="block text-sm font-medium text-[var(--fg)] mb-1.5"
                      >
                        Tutar (₺)
                      </label>
                      <input
                        id="yeni-kalem-tutar"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={newItem.amount}
                        onChange={(e) => setNewItem({...newItem, amount: Number(e.target.value)})}
                        className={cx(GIRDI_SINIFI, "tabular-nums")}
                        placeholder="0"
                      />
                    </div>

                    <div className="flex items-end">
                      <Dugme onClick={addBudgetItem} className="w-full">
                        Ekle
                      </Dugme>
                    </div>
                  </div>
                </div>
              )}

              {/* Budget Items List */}
              {budgetItems.length === 0 ? (
                <BosDurum
                  baslik="Henüz maliyet kalemi yok"
                  aciklama={
                    isPlanEditable(selectedTrip)
                      ? 'Harcamalarınızı kalem kalem ekleyerek bütçenizi takip edin.'
                      : 'Bu plan salt okunur. Yalnızca "Planlandı" durumundaki ve başlangıç tarihi geçmemiş planlar düzenlenebilir.'
                  }
                  eylem={
                    isPlanEditable(selectedTrip) ? (
                      <Dugme onClick={() => setShowAddForm(true)}>Kalem ekle</Dugme>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {/*
                    Kaynaklı kalemler bir arama sonucundan derlendi; bu bir
                    rezervasyon fiyatı DEĞİL. Rozet tek başına bunu anlatmıyor,
                    açık bir cümle gerekiyor — bu bir ürün değil güven meselesi.
                  */}
                  {budgetItems.some((item) => item.source) && (
                    <p className="text-sm text-[var(--fg-muted)] bg-[var(--info-soft)] border border-transparent rounded-[var(--radius)] p-3">
                      &quot;harici kaynak&quot; etiketli tutarlar internetteki arama
                      sonuçlarından derlenmiş <strong>tahminlerdir</strong>; güncel
                      rezervasyon fiyatı değildir. Kesinleştirmek için bağlantıdaki
                      kaynağı kontrol edin.
                    </p>
                  )}
                  {budgetItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]"
                    >
                      <div className="min-w-0">
                        <div>
                          <h4 className="font-medium text-[var(--fg)]">{item.description}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <p className="text-sm text-[var(--fg-muted)]">
                              {categoryLabels[item.category] || item.category}
                            </p>
                            {item.source && (
                              // `rel="noopener noreferrer"` şart: hedef sayfa
                              // AI'ın bulduğu, güvenilmeyen bir adres.
                              <a
                                href={item.source}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                title={`Tahmin şu kaynağa dayanıyor: ${item.source}`}
                                className="text-xs bg-[var(--info-soft)] text-[var(--info)] px-2 py-0.5 rounded-full border border-transparent hover:underline underline-offset-2 transition-colors"
                              >
                                harici kaynak ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-bold text-[var(--fg)]">₺{item.amount.toLocaleString('tr-TR')}</div>
                          <div className="text-sm text-[var(--fg-muted)]">
                            {item.isEstimate ? 'Tahmini' : 'Kesin'}
                          </div>
                        </div>
                        
                        {isPlanEditable(selectedTrip) && (
                          <button
                            onClick={() => togglePaidStatus(item.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              item.isPaid 
                                ? 'bg-[var(--ok-soft)] text-[var(--ok)]' 
                                : 'bg-[var(--warn-soft)] dark:bg-[var(--warn-soft)] text-[var(--warn)]'
                            }`}
                          >
                            {item.isPaid ? 'Ödendi' : 'Ödenmedi'}
                          </button>
                        )}
                        {!isPlanEditable(selectedTrip) && (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            item.isPaid 
                              ? 'bg-[var(--ok-soft)] text-[var(--ok)]' 
                              : 'bg-[var(--warn-soft)] dark:bg-[var(--warn-soft)] text-[var(--warn)]'
                          }`}>
                            {item.isPaid ? 'Ödendi' : 'Ödenmedi'}
                          </span>
                        )}
                        
                        {isPlanEditable(selectedTrip) && (
                          <button
                            onClick={() => deleteBudgetItem(item.id)}
                            className="text-[var(--danger)] hover:text-[var(--danger)] p-1"
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </Kart>

            {/* Budget Tips */}
            <div className="bg-[var(--accent)] p-6 rounded-[var(--radius-lg)] border border-transparent">
              <h3 className="text-lg font-medium text-[var(--info)] mb-3">Bütçe İpuçları</h3>
              <ul className="list-disc list-inside space-y-2 text-[var(--accent)]">
                <li>Yerel marketlerden alışveriş yaparak yemek maliyetlerinizi düşürebilirsiniz</li>
                <li>Şehir kartları ile ulaşım ve müze girişlerinde tasarruf sağlayabilirsiniz</li>
                <li>Önceden rezervasyon yaparak konaklama maliyetlerini optimize edebilirsiniz</li>
                <li>Yerel festivaller ve ücretsiz etkinlikleri takip ederek eğlence bütçenizi dengeleyebilirsiniz</li>
              </ul>
            </div>
          </>
        )}

        {trips.length === 0 && (
          <div className="text-center py-16">
            <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">Henüz Gezi Yok</h2>
            <p className="text-[var(--fg-muted)] mb-6">
              Bütçe planlamak için önce bir gezi planı oluşturun.
            </p>
            <button
              onClick={() => router.push('/travel-mode')}
              className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)]"
            >
              İlk Gezinizi Planlayın
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



