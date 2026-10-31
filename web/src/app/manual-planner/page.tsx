'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useSession } from "next-auth/react";
import { logger } from "@/lib/logger";
import { gunSayisi } from "@/lib/trip-dates";
import { SEHIRLER, rotaHesapla, type RotaOzeti } from "@/lib/seyahat-mesafe";
import {
  GirisGerekli,
  Olcum,
  SayfaKabugu,
  Serit,
  Yukleniyor,
} from "@/components/ui";

/**
 * Manuel planlayıcıdaki tahmini kalemler.
 *
 * Bu iki değer eskiden hesap fonksiyonunun içine gömülü sihirli sayılardı
 * (`dailyPlans.length * 150` ve `500`). Kullanıcı bunların nereden geldiğini
 * göremiyordu; en azından tek yerde ve adlandırılmış duruyorlar.
 */
/** Bağlantı metninde tam URL değil, alan adı gösteriliyor. */
function yeniAlanAdi(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const GUNLUK_YEMEK_TAHMINI = 150;
const DIGER_MASRAF_TAHMINI = 500;

// TypeScript interfaces
interface BasicInfo {
  /** Kalkış şehri. Ulaşım süresi ve maliyeti buradan hesaplanıyor. */
  origin: string;
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelStyle: string;
}

interface TransportOption {
  id: string;
  type: string;
  provider: string;
  price: number;
  duration: string;
  departure: string;
  arrival: string;
  selected: boolean;
  /** Bu modda kat edilen tahmini mesafe (km). */
  distanceKm?: number;
  /** Maliyet kişi başına mı, araç başına mı? */
  costUnit?: 'kisi' | 'arac';
  /** Web aramasından gelen satış/karşılaştırma siteleri. */
  sources?: { baslik: string; url: string }[];
}

interface AccommodationOption {
  id: string;
  name: string;
  type: string;
  rating: number;
  price: number;
  location: string;
  amenities: string[];
  selected: boolean;
}

interface DayPlan {
  day: number;
  activities: Activity[];
  notes: string;
  isEmpty: boolean;
}

interface Activity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cost: number;
  description?: string;
}

interface BudgetAnalysis {
  currentBudget: number;
  estimatedTotal: number;
  breakdown: {
    transport: number;
    accommodation: number;
    activities: number;
    food: number;
    other: number;
  };
}

interface TravelPlan {
  basicInfo: BasicInfo;
  transport: TransportOption | null;
  accommodation: AccommodationOption | null;
  dailyPlans: DayPlan[];
  budget: BudgetAnalysis;
}

// DayPlanCard component
interface DayPlanCardProps {
  day: DayPlan;
  dayIndex: number;
  onPlanChange: (dayIndex: number, field: keyof DayPlan, value: string | boolean) => void;
  onAddActivity: (dayIndex: number, activity: Activity) => void;
  onRemoveActivity: (dayIndex: number, activityIndex: number) => void;
}

function DayPlanCard({ day, dayIndex, onPlanChange, onAddActivity, onRemoveActivity }: DayPlanCardProps) {
  const [newActivity, setNewActivity] = useState({
    name: '',
    startTime: '',
    endTime: '',
    cost: 0,
    description: ''
  });

  const handleAddActivity = () => {
    if (newActivity.name.trim() && newActivity.startTime && newActivity.endTime) {
      const activity: Activity = {
        id: Date.now().toString(),
        name: newActivity.name.trim(),
        startTime: newActivity.startTime,
        endTime: newActivity.endTime,
        cost: newActivity.cost,
        description: newActivity.description
      };
      onAddActivity(dayIndex, activity);
      setNewActivity({
        name: '',
        startTime: '',
        endTime: '',
        cost: 0,
        description: ''
      });
    }
  };

  return (
    <div className="p-6 border border-[var(--line)] rounded-[var(--radius-lg)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--fg)]">
          {day.day}. Gün
        </h3>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={day.isEmpty}
            onChange={(e) => onPlanChange(dayIndex, 'isEmpty', e.target.checked)}
            className="w-4 h-4 text-[var(--accent)] bg-[var(--surface-2)] border-[var(--line-strong)] rounded focus:ring-[var(--accent)] dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-[var(--surface-2)] dark:border-[var(--line-strong)]"
          />
          <span className="text-sm text-[var(--fg-muted)]">Boş gün</span>
        </label>
      </div>

      {!day.isEmpty && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
              Aktiviteler
            </label>
            <div className="space-y-3 mb-4">
              {day.activities.map((activity, actIndex) => (
                <div key={activity.id} className="p-4 bg-[var(--accent-soft)] rounded-lg border border-transparent">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-[var(--info)]">{activity.name}</h4>
                    <button
                      onClick={() => onRemoveActivity(dayIndex, actIndex)}
                      className="text-[var(--danger)] hover:text-[var(--danger)] ml-2"
                    >
                      Sil
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm text-[var(--accent)]">
                    <div>
                      <span className="font-medium">Saat:</span> {activity.startTime} - {activity.endTime}
                    </div>
                    <div>
                      <span className="font-medium">Maliyet:</span> ₺{activity.cost}
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-[var(--accent-soft)] dark:bg-[var(--accent-soft)] px-2 py-1 rounded">
                        {(() => {
                          const start = new Date(`1970-01-01T${activity.startTime}:00`);
                          const end = new Date(`1970-01-01T${activity.endTime}:00`);
                          const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                          return `${Math.round(diffMinutes)} dk`;
                        })()}
                      </span>
                    </div>
                  </div>
                  {activity.description && (
                    <p className="text-sm text-[var(--accent)] mt-2 italic">
                      {activity.description}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Aktivite Ekleme Formu */}
            <div className="p-4 bg-[var(--surface-2)] rounded-lg border-2 border-dashed border-[var(--line-strong)]">
              <h4 className="font-medium text-[var(--fg-muted)] mb-3">Yeni Aktivite Ekle</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
                    Aktivite Adı *
                  </label>
                  <input
                    type="text"
                    value={newActivity.name}
                    onChange={(e) => setNewActivity({...newActivity, name: e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface)] dark:text-[var(--fg)] text-sm"
                    placeholder="Ör: Müze ziyareti"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
                    Maliyet (₺) *
                  </label>
                  <input
                    type="number"
                    value={newActivity.cost}
                    onChange={(e) => setNewActivity({...newActivity, cost: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface)] dark:text-[var(--fg)] text-sm"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
                    Başlangıç Saati *
                  </label>
                  <input
                    type="time"
                    value={newActivity.startTime}
                    onChange={(e) => setNewActivity({...newActivity, startTime: e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface)] dark:text-[var(--fg)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
                    Bitiş Saati *
                  </label>
                  <input
                    type="time"
                    value={newActivity.endTime}
                    onChange={(e) => setNewActivity({...newActivity, endTime: e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface)] dark:text-[var(--fg)] text-sm"
                  />
                </div>
              </div>
              
              <div className="mb-3">
                <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
                  Açıklama (İsteğe bağlı)
                </label>
                <textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                  className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface)] dark:text-[var(--fg)] text-sm"
                  placeholder="Aktivite hakkında notlar..."
                  rows={2}
                />
              </div>
              
              <button
                onClick={handleAddActivity}
                disabled={!newActivity.name.trim() || !newActivity.startTime || !newActivity.endTime}
                className="w-full px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg hover:bg-[var(--accent-hover)] disabled:bg-[var(--line-strong)] disabled:cursor-not-allowed text-sm font-medium"
              >
                Aktivite Ekle
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
              Günlük Notlar
            </label>
            <textarea
              value={day.notes}
              onChange={(e) => onPlanChange(dayIndex, 'notes', e.target.value)}
              className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
              rows={2}
              placeholder="Bu güne ait özel notlarınız..."
            />
          </div>

          {/* Günlük Özet */}
          {day.activities.length > 0 && (
            <div className="mt-4 p-3 bg-[var(--ok-soft)] rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--ok)]">
                  <strong>Günlük Özet:</strong> {day.activities.length} aktivite
                </span>
                <span className="text-[var(--ok)] font-medium sayisal">
                  Toplam: ₺{day.activities.reduce((sum, act) => (sum + act.cost), 0)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {day.isEmpty && (
        <div className="text-center py-8 text-[var(--fg-subtle)]">
          <p className="mt-2">Bu gün dinlenme günü olarak ayarlandı</p>
        </div>
      )}
    </div>
  );
}

export default function ManualPlannerPage() {
  const router = useRouter();
  const { status } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Bugünün tarihini al (YYYY-MM-DD formatında)
  const today = new Date().toISOString().split('T')[0];
  
  const [travelPlan, setTravelPlan] = useState<TravelPlan>({
    basicInfo: {
      origin: '',
      destination: '',
      country: '',
      startDate: '',
      endDate: '',
      travelers: 1,
      travelStyle: 'standard'
    },
    transport: null,
    accommodation: null,
    dailyPlans: [],
    budget: {
      currentBudget: 0,
      estimatedTotal: 0,
      breakdown: {
        transport: 0,
        accommodation: 0,
        activities: 0,
        food: 0,
        other: 0,
      }
    }
  });

  // Mock data - gerçek uygulamada API'den gelecek
  const [transportOptions, setTransportOptions] = useState<TransportOption[]>([]);
  /** Seçilen iki şehir arasındaki mesafe özeti; ulaşım adımında gösteriliyor. */
  const [rotaOzeti, setRotaOzeti] = useState<RotaOzeti | null>(null);
  /** Web araması sürüyor mu? Liste zaten dolu; yalnızca kaynaklar bekleniyor. */
  const [webAraniyor, setWebAraniyor] = useState(false);
  /** Arama gerçekten sonuç döndürdü mü? Anahtar yoksa false kalır. */
  const [webBulundu, setWebBulundu] = useState(false);

  /**
   * 1. adımdaki anlık mesafe önizlemesi.
   *
   * `rotaOzeti` ancak ulaşım adımına geçilince doluyor; kullanıcı şehirleri
   * seçer seçmez mesafeyi görebilsin diye ayrı ve türetilmiş.
   */
  const onIzlemeRotasi = useMemo(
    () => rotaHesapla(travelPlan.basicInfo.origin, travelPlan.basicInfo.destination),
    [travelPlan.basicInfo.origin, travelPlan.basicInfo.destination]
  );
  const [accommodationOptions, setAccommodationOptions] = useState<AccommodationOption[]>([]);

  const steps = [
    { id: 1, title: 'Temel Bilgiler', icon: '' },
    { id: 2, title: 'Ulaşım', icon: '' },
    { id: 3, title: 'Konaklama', icon: '' },
    { id: 4, title: 'Günlük Planlar', icon: '' },
    { id: 5, title: 'Maliyet Analizi', icon: '' },
    { id: 6, title: 'Özet & Kaydet', icon: '' }
  ];

  /**
   * Seyahat süresi: KAPSAYICI gün sayısı (bkz. src/lib/trip-dates.ts).
   *
   * Eski formül `Math.ceil((end - start) / GUN)` aralığı DIŞLAYICI sayıyordu:
   * 1-5 Ocak için 4 dönüyordu. Sonuç olarak günlük plan sekmesinde son gün
   * hiç görünmüyor, konaklama gecesi de bir eksik hesaplanıyordu.
   */
  const getTripDuration = useCallback(() => {
    return gunSayisi(travelPlan.basicInfo.startDate, travelPlan.basicInfo.endDate);
  }, [travelPlan.basicInfo.startDate, travelPlan.basicInfo.endDate]);

  // Create a simple string for activities cost tracking
  const activitiesCostString = travelPlan.dailyPlans.map(day => 
    day.activities.reduce((sum, act) => sum + act.cost, 0)
  ).join(',');

  // Update budget when relevant data changes
  useEffect(() => {
    // Gecikmeli güncelleme ile sonsuz döngüyü önle
    const timeoutId = setTimeout(() => {
      const { transport, accommodation, dailyPlans } = travelPlan;
      
      // Gerçek aktivite maliyetlerini hesapla
      const totalActivityCost = dailyPlans.reduce((total, day) => {
        if (day.isEmpty) return total;
        return total + day.activities.reduce((dayTotal, activity) => dayTotal + activity.cost, 0);
      }, 0);
      
      // Konaklama maliyeti (gece sayısı × gecelik fiyat).
      // Gece sayısı = gün sayısı - 1; gün sayısı artık kapsayıcı olduğu için
      // bu değer de doğru (1-5 Ocak → 5 gün, 4 gece).
      const duration = getTripDuration();
      const nights = Math.max(duration - 1, 0);
      const accommodationCost = accommodation ? accommodation.price * nights : 0;

      // Yemek maliyeti GÜN SAYISINA bağlı. Eskiden `dailyPlans.length`
      // kullanılıyordu; o dizi tarih değişiminden bir render sonra
      // güncellendiği için toplam geçici olarak yanlış görünüyordu.
      const breakdown = {
        transport: transport?.price || 0,
        accommodation: accommodationCost,
        activities: totalActivityCost,
        food: duration * GUNLUK_YEMEK_TAHMINI,
        other: DIGER_MASRAF_TAHMINI,
      };

      const estimatedTotal = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

      // Sadece budget değiştiyse güncelle (sonsuz döngüyü önlemek için)
      setTravelPlan(prev => {
        const currentTotal = prev.budget.estimatedTotal;
        const currentBreakdown = JSON.stringify(prev.budget.breakdown);
        const newBreakdown = JSON.stringify(breakdown);
        
        if (currentTotal !== estimatedTotal || currentBreakdown !== newBreakdown) {
          return {
            ...prev,
            budget: { ...prev.budget, breakdown, estimatedTotal }
          };
        }
        return prev;
      });
    }, 100); // 100ms gecikme

    return () => clearTimeout(timeoutId);
  }, [
    travelPlan.transport?.price,
    travelPlan.accommodation?.price,
    activitiesCostString,
    travelPlan.basicInfo.startDate,
    travelPlan.basicInfo.endDate,
    travelPlan.dailyPlans.length,
    getTripDuration,
    travelPlan
  ]);

  // Initialize daily plans when dates change
  useEffect(() => {
    const duration = getTripDuration();
    if (duration > 0 && duration !== travelPlan.dailyPlans.length) {
      const newPlans: DayPlan[] = Array.from({ length: duration }, (_, index) => ({
        day: index + 1,
        activities: [],
        notes: '',
        isEmpty: false
      }));
      setTravelPlan(prev => ({ ...prev, dailyPlans: newPlans }));
    }
  }, [travelPlan.basicInfo.startDate, travelPlan.basicInfo.endDate, getTripDuration, travelPlan.dailyPlans.length]);

  // Mock API calls - Fetch data when needed
  /**
   * Ulaşım seçenekleri artık ROTADAN türüyor.
   *
   * Eskiden burada üç sabit seçenek vardı ve hangi şehirden hangi şehre
   * gidildiğinden bağımsız olarak hep aynı süreyi/fiyatı gösteriyordu —
   * İstanbul'dan Bolu'ya da, İstanbul'dan Kars'a da "Otobüs · 8 saat ·
   * ₺150". Artık `rotaHesapla` iki şehir arasındaki mesafeden süre ve
   * tahmini maliyet üretiyor; kısa mesafede uçak, demiryolu olmayan
   * güzergâhta tren hiç sunulmuyor.
   *
   * Kalkış saatleri temsilî: elimizde sefer tarifesi yok, o yüzden
   * "Esnek" yazıyoruz ve süreyi tarifeden değil mesafeden veriyoruz.
   */
  const fetchTransportOptions = async () => {
    const rota = rotaHesapla(travelPlan.basicInfo.origin, travelPlan.basicInfo.destination);
    setRotaOzeti(rota);

    if (!rota || rota.secenekler.length === 0) {
      setTransportOptions([]);
      return;
    }

    // ÖNCE YEREL TAHMİN. Anında geliyor ve ağ olmadan da çalışıyor;
    // kullanıcı listeyi beklemeden görüyor.
    const yerel: TransportOption[] = rota.secenekler.map((s, i) => ({
      id: `${s.tur}-${i}`,
      type: s.tur,
      provider: s.saglayici,
      price: s.tahminiTl,
      duration: s.sureMetni,
      departure: 'Esnek',
      arrival: 'Esnek',
      distanceKm: s.mesafeKm,
      costUnit: s.maliyetBirimi,
      selected: travelPlan.transport?.type === s.tur,
    }));
    setTransportOptions(yerel);

    // SONRA WEB KAYNAKLARI. Arka planda; başarısız olursa liste yerel
    // tahminlerle olduğu gibi kalıyor — arama bir zenginleştirme, önkoşul
    // değil.
    setWebAraniyor(true);
    try {
      const yanit = await fetch(
        `/api/transport-options?from=${encodeURIComponent(rota.nereden.ad)}` +
          `&to=${encodeURIComponent(rota.nereye.ad)}`
      );
      if (!yanit.ok) return;

      const govde = await yanit.json();
      const gelen = govde?.rota?.secenekler;
      if (!Array.isArray(gelen)) return;

      const kaynakHaritasi = new Map<string, { baslik: string; url: string }[]>(
        gelen.map((s: { tur: string; kaynaklar?: { baslik: string; url: string }[] }) => [
          s.tur,
          s.kaynaklar ?? [],
        ])
      );

      setTransportOptions((onceki) =>
        onceki.map((o) => ({ ...o, sources: kaynakHaritasi.get(o.type) ?? [] }))
      );
      setWebBulundu(Boolean(govde?.rota?.webAramasiYapildi));
    } catch (error) {
      logger.error('Ulaşım kaynakları alınamadı', error);
    } finally {
      setWebAraniyor(false);
    }
  };

  const fetchAccommodationOptions = async () => {
    // Simulated API call
    const mockAccommodation: AccommodationOption[] = [
      {
        id: '1',
        name: 'Grand Hotel',
        type: 'Otel',
        rating: 5,
        price: 800,
        location: 'Şehir Merkezi',
        amenities: ['WiFi', 'Kahvaltı', 'Spa', 'Havuz'],
        selected: false
      },
      {
        id: '2',
        name: 'Boutique Inn',
        type: 'Butik Otel',
        rating: 4,
        price: 450,
        location: 'Tarihi Bölge',
        amenities: ['WiFi', 'Kahvaltı', 'Restoran'],
        selected: false
      },
      {
        id: '3',
        name: 'Budget Hostel',
        type: 'Hostel',
        rating: 3,
        price: 120,
        location: 'Genç Bölge',
        amenities: ['WiFi', 'Ortak Mutfak'],
        selected: false
      }
    ];
    
    // Mark selected accommodation if exists
    const updatedOptions = mockAccommodation.map(option => ({
      ...option,
      selected: travelPlan.accommodation?.id === option.id
    }));
    
    setAccommodationOptions(updatedOptions);
  };

  const handleBasicInfoChange = (field: keyof BasicInfo, value: string | number) => {
    // Tarih validasyonu
    if (field === 'startDate' || field === 'endDate') {
      const dateValue = value as string;
      const selectedDate = new Date(dateValue);
      const todayDate = new Date(today);
      
      if (selectedDate < todayDate) {
        toast.error(`${field === 'startDate' ? 'Başlangıç' : 'Bitiş'} tarihi bugünden önce olamaz`);
        return;
      }
      
      // Eğer bitiş tarihi seçiliyorsa ve başlangıç tarihinden önceyse
      if (field === 'endDate' && travelPlan.basicInfo.startDate) {
        const startDate = new Date(travelPlan.basicInfo.startDate);
        if (selectedDate < startDate) {
          toast.error('Bitiş tarihi başlangıç tarihinden önce olamaz');
          return;
        }
      }
      
      // Eğer başlangıç tarihi seçiliyorsa ve bitiş tarihinden sonraysa
      if (field === 'startDate' && travelPlan.basicInfo.endDate) {
        const endDate = new Date(travelPlan.basicInfo.endDate);
        if (selectedDate > endDate) {
          toast.error('Başlangıç tarihi bitiş tarihinden sonra olamaz');
          return;
        }
      }
    }
    
    setTravelPlan(prev => ({
      ...prev,
      basicInfo: { ...prev.basicInfo, [field]: value }
    }));
  };

  const handleTransportSelect = (transportId: string) => {
    const selected = transportOptions.find(t => t.id === transportId);
    if (selected) {
      setTravelPlan(prev => ({
        ...prev,
        transport: { ...selected, selected: true },
        budget: {
          ...prev.budget,
          breakdown: { ...prev.budget.breakdown, transport: selected.price }
        }
      }));
    }
  };

  const handleAccommodationSelect = (accommodationId: string) => {
    const selected = accommodationOptions.find(a => a.id === accommodationId);
    if (selected) {
      setTravelPlan(prev => ({
        ...prev,
        accommodation: { ...selected, selected: true }
      }));
    }
  };

  const handleDayPlanChange = (dayIndex: number, field: keyof DayPlan, value: string | boolean) => {
    setTravelPlan(prev => ({
      ...prev,
      dailyPlans: prev.dailyPlans.map((plan, index) =>
        index === dayIndex ? { ...plan, [field]: value } : plan
      )
    }));
  };

  const addActivity = (dayIndex: number, activity: Activity) => {
    setTravelPlan(prev => ({
      ...prev,
      dailyPlans: prev.dailyPlans.map((plan, index) =>
        index === dayIndex
          ? { ...plan, activities: [...plan.activities, activity] }
          : plan
      )
    }));
  };

  const removeActivity = (dayIndex: number, activityIndex: number) => {
    setTravelPlan(prev => ({
      ...prev,
      dailyPlans: prev.dailyPlans.map((plan, index) =>
        index === dayIndex
          ? {
              ...plan,
              activities: plan.activities.filter((_, i) => i !== activityIndex)
            }
          : plan
      )
    }));
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      if (currentStep === 1) {
        if (!travelPlan.basicInfo.origin) {
          toast.error('Lütfen kalkış şehrini seçin');
          return;
        }
        if (!travelPlan.basicInfo.destination) {
          toast.error('Lütfen hedef şehri seçin');
          return;
        }
        if (travelPlan.basicInfo.origin === travelPlan.basicInfo.destination) {
          toast.error('Kalkış ve varış şehri aynı olamaz');
          return;
        }
        
        // Tarih validasyonları
        if (travelPlan.basicInfo.startDate) {
          const startDate = new Date(travelPlan.basicInfo.startDate);
          const todayDate = new Date(today);
          
          if (startDate < todayDate) {
            toast.error('Başlangıç tarihi bugünden önce olamaz');
            return;
          }
        }
        
        if (travelPlan.basicInfo.endDate) {
          const endDate = new Date(travelPlan.basicInfo.endDate);
          const todayDate = new Date(today);
          
          if (endDate < todayDate) {
            toast.error('Bitiş tarihi bugünden önce olamaz');
            return;
          }
        }
        
        if (travelPlan.basicInfo.startDate && travelPlan.basicInfo.endDate) {
          const startDate = new Date(travelPlan.basicInfo.startDate);
          const endDate = new Date(travelPlan.basicInfo.endDate);
          
          if (startDate > endDate) {
            toast.error('Başlangıç tarihi bitiş tarihinden sonra olamaz');
            return;
          }
        }
      }
      
      if (currentStep === 1) {
        fetchTransportOptions();
      }
      if (currentStep === 2) {
        fetchAccommodationOptions();
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      // Önceki adıma geçerken seçenekleri güncelle
      if (currentStep === 3 || currentStep === 2) {
        // Ulaşım adımına geri dönüyoruz, seçenekleri güncelle
        fetchTransportOptions();
      }
      if (currentStep === 4 || currentStep === 3) {
        // Konaklama adımına geri dönüyoruz, seçenekleri güncelle
        fetchAccommodationOptions();
      }
      setCurrentStep(currentStep - 1);
    }
  };

  const savePlan = async () => {
    try {
      // İstemci kendi kimliğini göndermiyor; sunucu oturumdan çözüyor.
      const response = await fetch('/api/manual-travel-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(travelPlan)
      });

      if (response.ok) {
        toast.success('Seyahat planınız başarıyla kaydedildi!');
        router.push('/my-plans');
        return;
      }

      // Sunucunun anlattığı hatayı gösteriyoruz; eskiden her hata aynı
      // genel mesaja dönüşüyor ve kullanıcı neyi düzelteceğini bilmiyordu.
      const hata = await response.json().catch(() => null);
      toast.error(hata?.error || 'Plan kaydedilirken bir hata oluştu');
    } catch (error) {
      logger.error("Plan kaydedilemedi", error);
      toast.error('Plan kaydedilirken bir hata oluştu');
    }
  };

  const cancelPlan = () => {
    if (confirm('Planınızı iptal etmek istediğinizden emin misiniz? Tüm veriler kaybolacak.')) {
      router.push('/travel-mode');
    }
  };

  // Session kontrol için UI
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

  return (
    <SayfaKabugu>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] mb-3">
            Adım Adım Seyahat Planlama
          </h1>
          <p className="text-[var(--fg-muted)]">
            Seyahatinizi detaylıca planlayın ve bütçenizi kontrol edin
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-center space-x-4 overflow-x-auto pb-4">
            {steps.map((step, index) => (
              /* `relative` EKLENDİ. Aşağıdaki bağlayıcı çizgi `absolute
                 left-full` ile konumlanıyor; konumlandırılmış bir ata
                 olmadığı için beşi birden SAYFANIN sağ kenarına göre
                 hizalanıyor ve gövdeyi 80px yatay kaydırmaya zorluyordu.
                 Artık çizgi ait olduğu adımın sağına çıkıyor. */
              <div
                key={step.id}
                className={`relative flex flex-col items-center min-w-0 ${
                  currentStep >= step.id
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--fg-subtle)] dark:text-[var(--fg-muted)]'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-2 transition-colors duration-150 ${
                    currentStep >= step.id
                      ? 'bg-[var(--accent-soft)] border-2 border-[var(--accent)]'
                      : 'bg-[var(--surface-2)] border-2 border-[var(--line-strong)]'
                  }`}
                >
                  {step.icon}
                </div>
                <span className="text-sm font-medium text-center px-2">{step.title}</span>
                {index < steps.length - 1 && (
                  <div
                    className={`hidden md:block absolute top-6 left-full w-16 h-0.5 ${
                      currentStep > step.id ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]'
                    }`}
                    style={{ marginLeft: '1rem' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto">
          {/* Step 2: Ulaşım */}
          {currentStep === 2 && (
            <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-8">
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                Ulaşım
              </h2>

              {/* Rota künyesi: seçenekler bu iki şehir arasındaki mesafeden
                  hesaplandığı için mesafe listenin ÜSTÜNDE duruyor. */}
              {rotaOzeti && (
                <>
                  <p className="text-[var(--fg-muted)] mb-5">
                    {rotaOzeti.nereden.ad} → {rotaOzeti.nereye.ad}
                    <span className="sayisal">
                      {' · '}
                      {rotaOzeti.karayoluKm.toLocaleString('tr-TR')} km karayolu
                    </span>
                  </p>

                  <div className="mb-6">
                    <Serit ton="bilgi">
                      Süre ve fiyatlar mesafeden hesaplanan{' '}
                      <strong>tahminlerdir</strong>; sefer tarifesi değildir.
                      {webAraniyor && ' Güncel fiyatlar için satış siteleri aranıyor…'}
                      {!webAraniyor && webBulundu && ' Güncel fiyat için aşağıdaki bağlantıları kullanın.'}
                    </Serit>
                  </div>
                </>
              )}

              {travelPlan.transport && (
                <div className="mb-6 rounded-[var(--radius)] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3">
                  <p className="lejant text-[var(--accent)]">Seçili ulaşım</p>
                  <p className="text-[var(--fg)] mt-1">
                    {travelPlan.transport.type} · {travelPlan.transport.provider}
                    <span className="sayisal"> · ₺{travelPlan.transport.price.toLocaleString('tr-TR')}</span>
                  </p>
                </div>
              )}

              {/* Rota hesaplanamadıysa liste boş kalır; kullanıcı neden
                  boş olduğunu bilmeli. */}
              {transportOptions.length === 0 && (
                <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] px-6 py-10 text-center">
                  <p className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                    Ulaşım seçeneği hesaplanamadı
                  </p>
                  <p className="text-[var(--fg-muted)] mt-2 max-w-md mx-auto leading-relaxed">
                    Önceki adımda kalkış ve varış şehirlerinin ikisini de seçtiğinizden
                    emin olun.
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                {transportOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleTransportSelect(option.id)}
                    className={`p-6 border-2 rounded-[var(--radius-lg)] cursor-pointer transition-colors duration-150 ${
                      travelPlan.transport?.id === option.id
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--line)] hover:border-[var(--line)] hover:shadow-md'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h3 className="text-lg font-semibold text-[var(--fg)]">
                            {option.type} - {option.provider}
                          </h3>
                          {travelPlan.transport?.id === option.id && (
                            <span className="ml-3 px-2 py-1 bg-[var(--accent)] text-[var(--accent-contrast)] text-xs rounded-full">
                              Seçili
                            </span>
                          )}
                        </div>
                        <dl className="flex flex-wrap gap-x-6 gap-y-1 mt-1">
                          <div className="flex gap-2">
                            <dt className="lejant text-[var(--fg-subtle)]">Süre</dt>
                            <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-[var(--fg)] sayisal">
                              {option.duration}
                            </dd>
                          </div>
                          {option.distanceKm != null && (
                            <div className="flex gap-2">
                              <dt className="lejant text-[var(--fg-subtle)]">Mesafe</dt>
                              <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-[var(--fg-muted)] sayisal">
                                {option.distanceKm.toLocaleString('tr-TR')} km
                              </dd>
                            </div>
                          )}
                        </dl>

                        {/* Web kaynakları: TAHMİNİN yanında, onun yerine
                            değil. Kullanıcı gerçek fiyatı buradan görüyor;
                            biz uydurmuyoruz. */}
                        {option.sources && option.sources.length > 0 && (
                          <div className="mt-3">
                            <p className="lejant text-[var(--fg-subtle)] mb-1.5">
                              Güncel fiyat
                            </p>
                            <ul className="flex flex-wrap gap-x-3 gap-y-1">
                              {option.sources.map((k) => (
                                <li key={k.url}>
                                  <a
                                    href={k.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline underline-offset-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                  >
                                    {yeniAlanAdi(k.url)}
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
                                    </svg>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-[family-name:var(--font-serif)] text-2xl text-[var(--accent)] sayisal">
                          ₺{option.price.toLocaleString('tr-TR')}
                        </span>
                        <p className="lejant text-[var(--fg-subtle)] mt-1">
                          {option.costUnit === 'arac' ? 'Araç başı' : 'Kişi başı'} · tahmini
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Konaklama */}
          {currentStep === 3 && (
            <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-8">
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-5 flex items-center">
                Konaklama Seçenekleri
              </h2>
              
              {/* Mevcut seçim göster */}
              {travelPlan.accommodation && (
                <div className="mb-6 p-4 bg-[var(--ok-soft)] border border-transparent rounded-lg">
                  <h3 className="text-[var(--ok)] font-semibold mb-2">Seçili Konaklama:</h3>
                  <p className="text-[var(--ok)]">
                    {travelPlan.accommodation.name} - {travelPlan.accommodation.type} (₺{travelPlan.accommodation.price}/gece)
                  </p>
                </div>
              )}
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accommodationOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleAccommodationSelect(option.id)}
                    className={`p-6 border-2 rounded-[var(--radius-lg)] cursor-pointer transition-colors duration-150 ${
                      travelPlan.accommodation?.id === option.id
                        ? 'border-[var(--accent)] bg-[var(--ok-soft)]'
                        : 'border-[var(--line)] hover:border-[var(--line)] hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-[var(--fg)]">
                        {option.name}
                      </h3>
                      {travelPlan.accommodation?.id === option.id && (
                        <span className="px-2 py-1 bg-[var(--accent)] text-[var(--accent-contrast)] text-xs rounded-full">
                          Seçili
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--fg-muted)] mb-2">
                      {option.type} • {option.location}
                    </p>
                    <div className="flex items-center mb-3">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={`text-sm ${
                            i < option.rating ? 'text-[var(--warn)]' : 'text-[var(--fg-subtle)]'
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {option.amenities.map((amenity) => (
                        <span
                          key={amenity}
                          className="px-2 py-1 bg-[var(--info-soft)] text-[var(--info)] text-xs rounded"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                    <div className="text-center">
                      <span className="font-[family-name:var(--font-serif)] text-xl text-[var(--accent)] sayisal">
                        ₺{option.price}
                      </span>
                      <p className="text-sm text-[var(--fg-subtle)]">gecelik</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Günlük Planlar */}
          {currentStep === 4 && (
            <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-8">
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-5 flex items-center">
                Günlük Planlar
              </h2>
              
              <div className="space-y-6">
                {travelPlan.dailyPlans.map((day, index) => (
                  <DayPlanCard
                    key={index}
                    day={day}
                    dayIndex={index}
                    onPlanChange={handleDayPlanChange}
                    onAddActivity={addActivity}
                    onRemoveActivity={removeActivity}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Maliyet Analizi */}
          {currentStep === 5 && (
            <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-8">
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-5 flex items-center">
                Maliyet Analizi
              </h2>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                    Mevcut Bütçeniz (₺)
                  </label>
                  <input
                    type="number"
                    value={travelPlan.budget.currentBudget}
                    onChange={(e) => setTravelPlan(prev => ({
                      ...prev,
                      budget: { ...prev.budget, currentBudget: parseFloat(e.target.value) || 0 }
                    }))}
                    className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                    placeholder="Örn: 10000"
                  />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-[var(--fg)] mb-4">
                    Tahmini Harcama Dağılımı
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(travelPlan.budget.breakdown).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize text-[var(--fg-muted)]">
                          {key === 'transport' ? 'Ulaşım' :
                           key === 'accommodation' ? 'Konaklama' :
                           key === 'activities' ? 'Aktiviteler' :
                           key === 'food' ? 'Yemek' : 'Diğer'}:
                        </span>
                        <span className="font-semibold">₺{value}</span>
                      </div>
                    ))}
                    <hr className="my-2" />
                    <div className="flex justify-between text-lg font-medium sayisal">
                      <span>Toplam:</span>
                      <span>₺{travelPlan.budget.estimatedTotal}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg">
                {travelPlan.budget.currentBudget > travelPlan.budget.estimatedTotal ? (
                  <div className="bg-[var(--ok-soft)] border border-transparent text-[var(--ok)]">
                    <h4 className="font-semibold">Bütçeniz Yeterli!</h4>
                    <p>Kalan tutar: ₺{travelPlan.budget.currentBudget - travelPlan.budget.estimatedTotal}</p>
                  </div>
                ) : (
                  <div className="bg-[var(--danger-soft)] border border-transparent text-[var(--danger)]">
                    <h4 className="font-semibold">Bütçe Aşımı!</h4>
                    <p>Eksik tutar: ₺{travelPlan.budget.estimatedTotal - travelPlan.budget.currentBudget}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Özet & Kaydet */}
          {currentStep === 6 && (
            <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-8">
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-5 flex items-center">
                Plan Özeti
              </h2>
              
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Temel Bilgiler */}
                  <div className="p-4 bg-[var(--surface-2)] rounded-lg">
                    <h3 className="font-semibold text-[var(--fg)] mb-3 flex items-center">
                      Temel Bilgiler
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Hedef:</strong> {travelPlan.basicInfo.destination}, {travelPlan.basicInfo.country}</p>
                      <p><strong>Tarih:</strong> {travelPlan.basicInfo.startDate} - {travelPlan.basicInfo.endDate}</p>
                      <p><strong>Süre:</strong> {getTripDuration()} gün</p>
                      <p><strong>Kişi:</strong> {travelPlan.basicInfo.travelers}</p>
                      <p><strong>Tarz:</strong> {travelPlan.basicInfo.travelStyle}</p>
                    </div>
                  </div>
                  
                  {/* Ulaşım Bilgileri */}
                  <div className="p-4 bg-[var(--accent-soft)] rounded-lg">
                    <h3 className="font-semibold text-[var(--fg)] mb-3 flex items-center">
                      Seçilen Ulaşım
                    </h3>
                    {travelPlan.transport ? (
                      <div className="space-y-2 text-sm">
                        <p><strong>Tip:</strong> {travelPlan.transport.type}</p>
                        <p><strong>Sağlayıcı:</strong> {travelPlan.transport.provider}</p>
                        <p><strong>Süre:</strong> {travelPlan.transport.duration}</p>
                        <p><strong>Saat:</strong> {travelPlan.transport.departure} - {travelPlan.transport.arrival}</p>
                        <p><strong>Fiyat:</strong> ₺{travelPlan.transport.price} (kişi başı)</p>
                        <p><strong>Toplam:</strong> ₺{travelPlan.transport.price * travelPlan.basicInfo.travelers}</p>
                      </div>
                    ) : (
                      <p className="text-[var(--fg-subtle)] italic">Henüz ulaşım seçilmedi</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Konaklama Bilgileri */}
                  <div className="p-4 bg-[var(--ok-soft)] rounded-lg">
                    <h3 className="font-semibold text-[var(--fg)] mb-3 flex items-center">
                      Seçilen Konaklama
                    </h3>
                    {travelPlan.accommodation ? (
                      <div className="space-y-2 text-sm">
                        <p><strong>Otel:</strong> {travelPlan.accommodation.name}</p>
                        <p><strong>Tip:</strong> {travelPlan.accommodation.type}</p>
                        <p><strong>Konum:</strong> {travelPlan.accommodation.location}</p>
                        <p><strong>Puan:</strong> {'★'.repeat(travelPlan.accommodation.rating)} ({travelPlan.accommodation.rating}/5)</p>
                        <p><strong>Gecelik:</strong> ₺{travelPlan.accommodation.price}</p>
                        <p><strong>Toplam ({getTripDuration() - 1} gece):</strong> ₺{travelPlan.budget.breakdown.accommodation}</p>
                        <div className="mt-2">
                          <strong>Olanaklar:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {travelPlan.accommodation.amenities.map((amenity) => (
                              <span
                                key={amenity}
                                className="px-2 py-1 bg-[var(--accent-soft)] dark:bg-[var(--accent-soft)] text-[var(--info)] text-xs rounded"
                              >
                                {amenity}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[var(--fg-subtle)] italic">Henüz konaklama seçilmedi</p>
                    )}
                  </div>
                  
                  {/* Bütçe Özeti */}
                  <div className="p-4 bg-[var(--warn-soft)] rounded-[var(--radius)]">
                    <h3 className="font-semibold text-[var(--fg)] mb-3 flex items-center">
                      Bütçe Özeti
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Mevcut Bütçe:</strong> ₺{travelPlan.budget.currentBudget}</p>
                      <p><strong>Tahmini Toplam:</strong> ₺{travelPlan.budget.estimatedTotal}</p>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-[var(--fg-muted)]">Detaylı Dağılım:</p>
                        <p className="text-xs">• Ulaşım: ₺{travelPlan.budget.breakdown.transport}</p>
                        <p className="text-xs">• Konaklama: ₺{travelPlan.budget.breakdown.accommodation}</p>
                        <p className="text-xs">• Aktiviteler: ₺{travelPlan.budget.breakdown.activities}</p>
                        <p className="text-xs">• Yemek: ₺{travelPlan.budget.breakdown.food}</p>
                        <p className="text-xs">• Diğer: ₺{travelPlan.budget.breakdown.other}</p>
                      </div>
                      <div className="pt-2 border-t">
                        {travelPlan.budget.currentBudget >= travelPlan.budget.estimatedTotal ? (
                          <p className="text-[var(--accent)] font-semibold">
                            Bütçe Yeterli! (Kalan: ₺{travelPlan.budget.currentBudget - travelPlan.budget.estimatedTotal})
                          </p>
                        ) : (
                          <p className="text-[var(--danger)] font-semibold">
                            Bütçe Aşımı! (Eksik: ₺{travelPlan.budget.estimatedTotal - travelPlan.budget.currentBudget})
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Günlük Planlar Özeti */}
                {travelPlan.dailyPlans.length > 0 && (
                  <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)]">
                    <h3 className="font-semibold text-[var(--fg)] mb-3 flex items-center">
                      Günlük Planlar Özeti
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {travelPlan.dailyPlans.map((day, index) => (
                        <div key={index} className="p-3 bg-[var(--surface)] rounded border">
                          <h4 className="font-medium text-sm">{day.day}. Gün</h4>
                          {day.isEmpty ? (
                            <p className="text-xs text-[var(--fg-subtle)] italic">Dinlenme günü</p>
                          ) : (
                            <p className="text-xs text-[var(--fg-muted)]">
                              {day.activities.length} aktivite planlandı
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {currentStep === 1 && (
            <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-8">
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-5 flex items-center">
                Temel Bilgiler
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Kalkış ve varış artık SEÇİLİYOR, serbest metin değil:
                    ulaşım süresi ve maliyeti bu iki şehrin koordinatından
                    hesaplanıyor, dolayısıyla tanınan bir il olmalı. */}
                <div>
                  <label htmlFor="origin" className="block text-sm font-medium text-[var(--fg)] mb-2">
                    Kalkış şehri *
                  </label>
                  <select
                    id="origin"
                    value={travelPlan.basicInfo.origin}
                    onChange={(e) => handleBasicInfoChange('origin', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                  >
                    <option value="">Seçin…</option>
                    {SEHIRLER.map((sehir) => (
                      <option key={sehir.ad} value={sehir.ad}>{sehir.ad}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="destination" className="block text-sm font-medium text-[var(--fg)] mb-2">
                    Varış şehri *
                  </label>
                  <select
                    id="destination"
                    value={travelPlan.basicInfo.destination}
                    onChange={(e) => handleBasicInfoChange('destination', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                  >
                    <option value="">Seçin…</option>
                    {SEHIRLER.filter((sehir) => sehir.ad !== travelPlan.basicInfo.origin).map((sehir) => (
                      <option key={sehir.ad} value={sehir.ad}>{sehir.ad}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                    Ülke
                  </label>
                  <input
                    type="text"
                    value={travelPlan.basicInfo.country}
                    onChange={(e) => handleBasicInfoChange('country', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                    placeholder="Örn: Türkiye"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                    Başlangıç Tarihi *
                  </label>
                  <input
                    type="date"
                    value={travelPlan.basicInfo.startDate}
                    min={today}
                    onChange={(e) => handleBasicInfoChange('startDate', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                    Bitiş Tarihi *
                  </label>
                  <input
                    type="date"
                    value={travelPlan.basicInfo.endDate}
                    min={travelPlan.basicInfo.startDate || today}
                    onChange={(e) => handleBasicInfoChange('endDate', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                    Kişi Sayısı
                  </label>
                  <select
                    value={travelPlan.basicInfo.travelers}
                    onChange={(e) => handleBasicInfoChange('travelers', parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                  >
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num}>{num} kişi</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                    Seyahat Tarzı
                  </label>
                  <select
                    value={travelPlan.basicInfo.travelStyle}
                    onChange={(e) => handleBasicInfoChange('travelStyle', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                  >
                    <option value="budget">Ekonomik</option>
                    <option value="standard">Standart</option>
                    <option value="luxury">Lüks</option>
                    <option value="adventure">Macera</option>
                    <option value="cultural">Kültürel</option>
                  </select>
                </div>
              </div>

              {/* Seçim yapılır yapılmaz mesafe görünüyor: kullanıcı ulaşım
                  adımına geçmeden önce yolun ne kadar olduğunu biliyor. */}
              {(getTripDuration() > 0 || onIzlemeRotasi) && (
                <div className="mt-6 grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)] rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-2)]">
                  {getTripDuration() > 0 && (
                    <Olcum
                      etiket="Seyahat süresi"
                      deger={`${getTripDuration()} gün`}
                      ton="aksan"
                      className="px-5 py-4"
                    />
                  )}
                  {onIzlemeRotasi && (
                    <>
                      <Olcum
                        etiket="Karayolu mesafesi"
                        deger={`${onIzlemeRotasi.karayoluKm.toLocaleString('tr-TR')} km`}
                        ton="rota"
                        className="px-5 py-4"
                      />
                      <Olcum
                        etiket="Kuş uçuşu"
                        deger={`${onIzlemeRotasi.kusUcusuKm.toLocaleString('tr-TR')} km`}
                        className="px-5 py-4"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-6 py-3 bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--line-strong)] rounded-lg hover:bg-[var(--surface-3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Önceki
            </button>
            
            <div className="text-center">
              <span className="text-sm text-[var(--fg-subtle)]">
                {currentStep} / {steps.length}
              </span>
            </div>
            
            {currentStep < steps.length ? (
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg hover:bg-[var(--accent-hover)]"
              >
                Sonraki
              </button>
            ) : (
              <div className="space-x-4">
                <button
                  onClick={cancelPlan}
                  className="px-6 py-3 bg-[var(--danger)] text-[var(--accent-contrast)] rounded-[var(--radius)] hover:bg-[var(--danger-hover)]"
                >
                  İptal Et
                </button>
                <button
                  onClick={savePlan}
                  className="px-6 py-3 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg hover:bg-[var(--accent-hover)]"
                >
                  Kaydet
                </button>
              </div>
            )}
          </div>
        </div>
    </SayfaKabugu>
  );
}


