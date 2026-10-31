"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { logger } from "@/lib/logger";
import { TripStatus } from "@/lib/trip-status";
import { gunSayisi, isoGunTarihi } from "@/lib/trip-dates";
import { gunleriCoz } from "@/lib/plan-budget";
import {
  ekranGununeCevir,
  gunFarkiBosMu,
  gunlukPlanFarkiCikar,
  type IliskiselGun,
} from "@/lib/gunluk-plan-esitleme";
import {
  GirisGerekli,
  SayfaHatasi,
  SayfaKabugu,
  Yukleniyor,
} from "@/components/ui";

interface Activity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cost: number;
  description?: string;
  category: string;
  location: string;
  /**
   * Çözülmüş konum. EKRAN BU ALANI GÖSTERMİYOR, yalnızca taşıyor.
   *
   * Tipte ilan edilmesi şart: kaydetme akışı aktiviteleri bu şekle göre
   * yeniden kuruyor ve alan burada yoksa her kaydetme planın harita
   * rotasını sessizce siler.
   */
  coordinates?: { lat: number; lng: number };
}

interface DayPlan {
  day: number;
  date: string;
  activities: Activity[];
  notes: string;
  isEmpty: boolean;
}

interface Trip {
  id: string;
  city: string;
  country: string | null;
  // API bu alanlari null dondurebiliyor.
  startDate: string | null;
  endDate: string | null;
  total_cost?: number | null;
  daily_cost?: number | null;
  budget_level?: string | null;
  travel_style?: string | null;
  /** API `"5 gun"` biciminde METIN donduruyor; sayi degil. */
  duration?: string | null;
  gun_plani?: string; // JSON string of daily plans
  status?: string | null;
  /**
   * İlişkisel modele taşınma damgası (B4).
   *
   * Doluysa günlük planlar `/api/trip/daily-plans` üzerinden GÜN BAZLI
   * okunup yazılıyor; boşsa `TripPlan.gun_plani` JSON sütunundan. Ayrımı
   * taşımanın kendi damgası yapıyor, dolaylı bir ipucu değil.
   */
  migratedAt?: string | null;
  /** Taşınmış planın bağlı olduğu `Trip` kimliği. */
  tripId?: string | null;
}

/** Plan ilişkisel modelde mi yaşıyor? İki alan da dolu olmak zorunda. */
function iliskiselMi(trip: Trip | null): trip is Trip & { tripId: string } {
  return Boolean(trip?.migratedAt && trip?.tripId);
}

/**
 * Kategori kodu → kullanıcıya gösterilen etiket.
 *
 * Bu harita kartta `text-xl` bir metin olarak basılıyordu VE hemen yanında
 * ham kategori kodu ayrı bir çip olarak duruyordu; yani kategori iki kez
 * yazılıyordu ("Ulaşım" + "ulaşım"). Artık tek yerde, çipin içinde.
 */
const KATEGORI_ETIKETLERI: Record<string, string> = {
  'ulaşım': 'Ulaşım',
  'konaklama': 'Konaklama',
  'yemek': 'Yemek',
  'aktiviteler': 'Aktiviteler',
  'alışveriş': 'Alışveriş',
  'eğlence': 'Eğlence',
  'kültür': 'Kültür',
  'gezi': 'Gezi',
  'diğer': 'Diğer'
};

/**
 * Zaman dilimi işareti.
 *
 * DÜZELTİLEN GÖRÜNMEZ METİN HATASI: dört zaman dilimi de kart ZEMİNİNİ
 * `bg-[var(--accent)]` yapıyordu, ama kartın içindeki başlık `--fg`,
 * ayrıntıları `--fg-muted` ile yazılıyordu. Aksan dolu bir eylem rengi;
 * üstüne yalnızca `--accent-contrast` yazılır. Koyu temada aksan açık mavi
 * olduğu için beyazımsı metin tamamen kayboluyordu (ekran görüntüsüyle
 * doğrulandı). Ayrıca `shadow-yellow-100` gibi ham Tailwind gölgeleri
 * paletin dışındaydı ve hiçbir görsel iş yapmıyordu.
 *
 * Kart artık normal yüzey. Zaman dilimi ayrımı, günün rotasındaki DURAK
 * noktasının rengiyle veriliyor — sabah/öğle/ikindi/akşam sırası zaten
 * bilgi taşıyor, o yüzden sıra rengi (rota) kullanılıyor.
 */
const ZAMAN_ETIKETLERI: Record<string, string> = {
  morning: 'Sabah',
  noon: 'Öğle',
  afternoon: 'İkindi',
  evening: 'Akşam',
};

// The parseMarkdownToPlans function has been moved inside the component

  // Plan düzenlenebilir mi kontrol et
  const isPlanEditable = (trip: Trip | null): boolean => {
    if (!trip) return false;

    // Sadece "Planlandı" durumundaki planlar düzenlenebilir.
    if (trip.status !== TripStatus.PLANNED) return false;

    // Tarihsiz plan gelecek sayılır; eskiden `new Date(null)` 1970 üretip
    // böyle planları kilitliyordu.
    if (!trip.startDate) return true;

    const startDate = new Date(trip.startDate);
    if (Number.isNaN(startDate.getTime())) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    // Plan başlangıç tarihi bugün veya gelecekte ise düzenlenebilir
    return startDate >= today;
  };

/** İki tarihi kullanıcıya gösterilecek aralığa çevirir; null'a dayanıklı. */
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

export default function DailyPlannerPage() {
  const { status } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [dailyPlans, setDailyPlans] = useState<DayPlan[]>([]);
  const [originalDailyPlans, setOriginalDailyPlans] = useState<DayPlan[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Yeni aktivite formu state'i
  const [newActivity, setNewActivity] = useState({
    name: '',
    startTime: '',
    endTime: '',
    cost: 0,
    description: '',
    category: 'aktiviteler',
    location: ''
  });

  // Saat dilimini belirle
  const getTimeOfDay = (time: string): string => {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 14) return 'noon';
    if (hour >= 14 && hour < 18) return 'afternoon';
    return 'evening';
  };

  // Planları parse et - useCallback ile sarmalanmış
  const parseMarkdownToPlans = useCallback((markdownContent: string): DayPlan[] => {
    
    const days: DayPlan[] = [];
    
    // Güvenli regex pattern'ler - sonsuz döngüyü önlemek için
    try {
      // İlk önce AI formatı deneyelim: #### 2025-09-05
      const aiDateMatches = [...markdownContent.matchAll(/#### (\d{4}-\d{2}-\d{2})/g)];
      
      if (aiDateMatches.length > 0) {
        aiDateMatches.forEach((match, index) => {
          const dateMatch = match[1];
          const dayNumber = index + 1;
          
          // Tarih formatını düzenle
          let dayDate: string;
          try {
            dayDate = new Date(dateMatch).toLocaleDateString('tr-TR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
          } catch {
            dayDate = dateMatch;
          }
          
          // Bu günün içeriğini al
          const dayStartIndex = match.index || 0;
          const nextMatch = aiDateMatches[index + 1];
          const dayEndIndex = nextMatch ? (nextMatch.index || markdownContent.length) : markdownContent.length;
          
          const dayContent = markdownContent.slice(dayStartIndex, dayEndIndex).trim();
          
          // Aktiviteleri çıkar
          const activities = extractActivitiesFromMarkdown(dayContent);
          
          days.push({
            day: dayNumber,
            date: dayDate,
            activities: activities,
            notes: dayContent,
            isEmpty: activities.length === 0
          });
        });
        
        return days.sort((a, b) => a.day - b.day);
      }
      
      // AI formatı bulunamazsa, manuel gün formatı deneyelim: ### 1. Gün
      const dayMatches = [...markdownContent.matchAll(/### (\d+)\. Gün/g)];
      
      if (dayMatches.length > 0) {
        dayMatches.forEach((match, index) => {
          const dayNumber = parseInt(match[1]);
          const dayDate = `${dayNumber}. Gün`;
          
          // Bu günün içeriğini al
          const dayStartIndex = match.index || 0;
          const nextMatch = dayMatches[index + 1];
          const dayEndIndex = nextMatch ? (nextMatch.index || markdownContent.length) : markdownContent.length;
          
          const dayContent = markdownContent.slice(dayStartIndex, dayEndIndex).trim();
          
          // Aktiviteleri çıkar
          const activities = extractActivitiesFromMarkdown(dayContent);
          
          days.push({
            day: dayNumber,
            date: dayDate,
            activities: activities,
            notes: dayContent,
            isEmpty: activities.length === 0
          });
        });
        
        return days.sort((a, b) => a.day - b.day);
      }
      
      // Hiçbir format bulunamazsa tek gün olarak işle
      const activities = extractActivitiesFromMarkdown(markdownContent);
      
      days.push({
        day: 1,
        date: '1. Gün',
        activities: activities,
        notes: markdownContent,
        isEmpty: activities.length === 0
      });
      
    } catch (error) {
      logger.error("Markdown ayrıştırılamadı", error);
      // Hata durumunda boş gün döndür
      days.push({
        day: 1,
        date: '1. Gün',
        activities: [],
        notes: 'Parsing hatası oluştu',
        isEmpty: true
      });
    }
    
    return days;
  }, []);

  /**
   * `gun_plani` sütununu okur.
   *
   * NEDEN PAYLAŞILAN ÇÖZÜCÜ: burada elle yazılmış bir `JSON.parse` vardı ve
   * `gunleriCoz`'dan üç noktada AYRILIYORDU — yani aynı plan bu ekranda
   * haritadan ve plan detayından farklı görünebiliyordu:
   *
   *  1. `day: index + 1` — kaydedilmiş gün numarasını yok sayıp diziyi
   *     yeniden numaralandırıyordu. Sıralı olmayan ya da gün atlayan bir
   *     kayıtta başlıklar tarihlerle çelişiyordu.
   *  2. `activities: plan.activities || []` — hiçbir doğrulama yok.
   *     `cost` metin gelirse toplamlar `NaN` oluyordu.
   *  3. `isEmpty: plan.isEmpty || false` — modelin İDDİASINA güveniyordu.
   *     `gunleriCoz` bunu aktivite sayısından türetiyor; boş bir günü
   *     "dolu" ilan eden bir model çıktısı burada dolu görünüyordu.
   *
   * Markdown yedeği KORUNUYOR: `gunleriCoz` yalnızca kök seviyede dizi olan
   * JSON'u tanıyor, eski markdown satırlarında `null` dönüyor.
   */
  const parseDailyPlans = useCallback((plansJson: string): DayPlan[] => {
    const gunler = gunleriCoz(plansJson);
    if (gunler) return gunler;

    logger.warn("Günlük planlar JSON değil, markdown yoluna düşülüyor");
    return parseMarkdownToPlans(plansJson);
  }, [parseMarkdownToPlans]);

  // Markdown formatından günlük planları parse et


  // Markdown içeriğinden aktiviteleri çıkar
  const extractActivitiesFromMarkdown = (dayContent: string): Activity[] => {
    const activities: Activity[] = [];
    let activityId = 1;
    
    
    try {
      // İlk pattern: AI formatı - **Sabah (09:00 - 12:00):** formatı
      const timeBlockMatches = [...dayContent.matchAll(/- \*\*(\w+) \((\d{1,2}:\d{2}) - (\d{1,2}:\d{2})\):\*\*/g)];
      
      if (timeBlockMatches.length > 0) {
        timeBlockMatches.forEach((match, index) => {
          const startTime = match[2];
          const endTime = match[3];
          
          
          // Bu zaman bloğundan sonraki içeriği al
          const blockStartIndex = (match.index || 0) + match[0].length;
          const nextMatch = timeBlockMatches[index + 1];
          const blockEndIndex = nextMatch ? (nextMatch.index || dayContent.length) : dayContent.length;
          
          const blockContent = dayContent.slice(blockStartIndex, blockEndIndex);
          
          // Bu blok içindeki aktiviteleri bul
          const blockActivities = blockContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('-') && line.length > 3)
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(text => text.length > 0);
          
          
          blockActivities.forEach((activityText) => {
            // Kategori belirle
            let category = 'aktiviteler';
            const lowText = activityText.toLowerCase();
            
            if (lowText.includes('yemek') || lowText.includes('kahvaltı') || 
                lowText.includes('öğle') || lowText.includes('akşam') ||
                lowText.includes('restoran') || lowText.includes('lokanta')) {
              category = 'yemek';
            } else if (lowText.includes('müze') || lowText.includes('tarihi') ||
                       lowText.includes('kültür') || lowText.includes('camii') ||
                       lowText.includes('kale') || lowText.includes('saray')) {
              category = 'kültür';
            } else if (lowText.includes('alışveriş') || lowText.includes('çarşı') ||
                       lowText.includes('pazar') || lowText.includes('mağaza')) {
              category = 'alışveriş';
            } else if (lowText.includes('park') || lowText.includes('doğa') ||
                       lowText.includes('bahçe') || lowText.includes('gezi')) {
              category = 'gezi';
            }
            
            const activity = {
              id: `ai-${activityId}`,
              name: activityText.length > 50 ? activityText.substring(0, 50) + '...' : activityText,
              startTime: startTime,
              endTime: endTime,
              cost: 0,
              description: activityText,
              category: category,
              location: ''
            };
            
            activities.push(activity);
            activityId++;
          });
        });
        
        return activities;
      }
      
      // Eğer zaman blokları bulunamazsa, basit zaman formatını dene
      const timeMatches = [...dayContent.matchAll(/(\d{1,2}:\d{2})\s*[-:]?\s*([^\n]+)/g)];
      
      if (timeMatches.length > 0) {
        timeMatches.forEach((match) => {
          const time = match[1];
          const description = match[2].trim();
          
          if (description.length > 3) { // Çok kısa açıklamaları görmezden gel
            activities.push({
              id: `simple-${activityId}`,
              name: description.length > 50 ? description.substring(0, 50) + '...' : description,
              startTime: time,
              endTime: time, // Bitiş saati bilinmiyor
              cost: 0,
              description: description,
              category: 'aktiviteler',
              location: ''
            });
            
            activityId++;
          }
        });
        
        return activities;
      }
      
      // Hala aktivite bulunamadıysa, sadece liste öğelerini al
      const lines = dayContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-') && line.length > 3)
        .slice(0, 20); // Maksimum 20 öğe al, sonsuz döngüyü önle
      
      
      lines.forEach((line) => {
        const activityText = line.replace(/^-\s*/, '').trim();
        if (activityText && activityText.length > 3) {
          activities.push({
            id: `list-${activityId}`,
            name: activityText.length > 50 ? activityText.substring(0, 50) + '...' : activityText,
            startTime: '09:00',
            endTime: '10:00',
            cost: 0,
            description: activityText,
            category: 'aktiviteler',
            location: ''
          });
          
          activityId++;
        }
      });
      
    } catch (error) {
      logger.error("Aktiviteler çıkarılamadı", error);
    }
    
    return activities;
  };

  /**
   * İlişkisel modeldeki (`DailyPlan` tablosu) günleri okur.
   *
   * Gün numarası SATIR SIRASINDAN türetiliyor: uç tarihe göre sıralı
   * döndürüyor ve ekran gün numarasını yalnızca sekme etiketi olarak
   * kullanıyor. Eşleştirmenin gerçek anahtarı tarih (bkz.
   * src/lib/gunluk-plan-esitleme.ts).
   */
  const iliskiselGunleriGetir = useCallback(
    async (tripId: string): Promise<DayPlan[]> => {
      const yanit = await fetch(
        `/api/trip/daily-plans?tripId=${encodeURIComponent(tripId)}`
      );
      if (!yanit.ok) throw new Error('Günlük planlar yüklenemedi');

      const govde = await yanit.json();
      const satirlar: IliskiselGun[] = Array.isArray(govde?.dailyPlans)
        ? govde.dailyPlans
        : [];

      return satirlar.map((satir, index) => ekranGununeCevir(satir, index + 1));
    },
    []
  );

  // Seçili trip için günlük planları yükle
  const loadDailyPlans = useCallback(async (trip: Trip) => {
    try {
      // İLİŞKİSEL YOL (B4): plan taşınmışsa günler kendi tablolarından
      // okunuyor, TripPlan'ın JSON sütunundan değil.
      if (iliskiselMi(trip)) {
        let plans = await iliskiselGunleriGetir(trip.tripId);

        // Taşıma sırasında boş günler kayıt üretmemiş olabilir; ekranda
        // seyahat süresi kadar gün görünmeli.
        if (plans.length === 0) {
          const duration = getDuration(trip);
          plans = Array.from({ length: duration }, (_, index) => ({
            day: index + 1,
            date: formatDate(trip.startDate, index),
            activities: [],
            notes: '',
            isEmpty: true
          }));
        }

        setDailyPlans(plans);
        if (plans.length > 0) setSelectedDay(plans[0].day);
        setOriginalDailyPlans([...plans]);
        setHasChanges(false);
        return;
      }

      const response = await fetch(`/api/plan-detail/${trip.id}`);
      
      if (!response.ok) {
        throw new Error('Plan detayı yüklenemedi');
      }
      
      const data = await response.json();
      
      if (data.success && data.plan) {
        let plans: DayPlan[] = [];
        
        if (data.plan.gun_plani) {
          
          // Eğer gun_plani string değilse (null, undefined vs), boş planlar oluştur
          if (typeof data.plan.gun_plani === 'string') {
            plans = parseDailyPlans(data.plan.gun_plani);
            plans = plans
              .map((p, idx) => ({ ...p, day: typeof p.day === 'number' && p.day > 0 ? p.day : idx + 1 }))
              .sort((a, b) => a.day - b.day);
          } else {
          }
        } else {
        }
        
        // Eğer planlar boşsa veya parse edilemiyorsa, trip süresine göre boş planlar oluştur
        if (plans.length === 0) {
          const duration = getDuration(trip);
          plans = Array.from({ length: duration }, (_, index) => ({
            day: index + 1,
            date: formatDate(trip.startDate, index),
            activities: [],
            notes: '',
            isEmpty: false
          }));
        }
        
        setDailyPlans(plans);
        if (plans.length > 0) {
          setSelectedDay(plans[0].day);
        }
        setOriginalDailyPlans([...plans]); // Orijinal planları sakla
        setHasChanges(false); // Yeni plan yüklendiğinde değişiklik yok
      }
    } catch (err) {
      logger.error("Günlük planlar yüklenemedi", err);
      toast.error('Günlük planlar yüklenemedi');
    }
  }, [parseDailyPlans, iliskiselGunleriGetir]);

  // Kullanıcı planlarını getir
  const fetchUserTrips = useCallback(async () => {
    try {
      const response = await fetch('/api/my-plans');
      
      if (!response.ok) {
        throw new Error('Planlar yüklenemedi');
      }
      
      const data = await response.json();
      
      const gelen: Trip[] = Array.isArray(data?.plans) ? data.plans : [];

      setTrips(gelen);
      if (gelen.length > 0) {
        setSelectedTrip(gelen[0]);
        loadDailyPlans(gelen[0]);
      }
    } catch (err) {
      logger.error("Geziler yüklenemedi", err);
      setError('Geziler yüklenemedi');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [loadDailyPlans]);

  /**
   * Trip süresi (KAPSAYICI gün sayısı).
   *
   * `duration` alanı `"5 gün"` biçiminde METİN; eski kod onu sayı sanıp
   * `trip.duration > 0` karşılaştırması yapıyordu (daima false). Gün sayısı
   * artık tarihlerden, paylaşılan yardımcıyla hesaplanıyor.
   */
  const getDuration = (trip: Trip): number => {
    return gunSayisi(trip.startDate, trip.endDate) || 1;
  };

  /**
   * Gün tarihi.
   *
   * ISO ("2026-01-03") üretiyor; serileştiricinin ürettiği `date` alanı da
   * ISO. Eskiden burada Türkçe uzun tarih üretiliyordu ve aynı ekranda AI
   * planının günleri ISO, boş planların günleri uzun metin görünüyordu.
   */
  const formatDate = (startDate: string | null, dayIndex: number): string => {
    return isoGunTarihi(startDate, dayIndex);
  };

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

  // Aktivite ekle
  const addActivity = async () => {
    if (!selectedTrip || !newActivity.name || !newActivity.startTime || !newActivity.endTime) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (!isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenemez. Sadece "Planlandı" durumundaki ve başlangıç tarihi geçmemiş planlar düzenlenebilir.');
      return;
    }

    const activity: Activity = {
      id: Date.now().toString(),
      ...newActivity
    };

    const updatedPlans = dailyPlans.map(plan => {
      if (plan.day === selectedDay) {
        return {
          ...plan,
          activities: [...plan.activities, activity]
        };
      }
      return plan;
    });

    const oncekiPlanlar = dailyPlans;
    setDailyPlans(updatedPlans);

    try {
      const sonuc = await saveDailyPlans(updatedPlans);
      maliyetleriGuncelle(sonuc);
      setOriginalDailyPlans([...updatedPlans]);
      setHasChanges(false);
      setNewActivity({
        name: '',
        startTime: '',
        endTime: '',
        cost: 0,
        description: '',
        category: 'aktiviteler',
        location: ''
      });
      setShowAddForm(false);
      toast.success('Aktivite eklendi ve kaydedildi');
    } catch (error) {
      // Kaydedilemediyse ekrandaki listeyi de geri aliyoruz; aksi halde
      // kullanici kaydedilmemis bir aktiviteyi kaydedilmis saniyordu.
      setDailyPlans(oncekiPlanlar);
      logger.error("Aktivite kaydedilemedi", error);
      toast.error(error instanceof Error ? error.message : 'Aktivite kaydedilemedi');
    }
  };

  // Aktivite sil
  const deleteActivity = async (activityId: string) => {
    if (!isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenemez. Sadece "Planlandı" durumundaki ve başlangıç tarihi geçmemiş planlar düzenlenebilir.');
      return;
    }

    if (!confirm('Bu aktiviteyi silmek istediğinizden emin misiniz?')) return;

    // Aktivitenin maliyetini bul
    let removedActivityCost = 0;
    dailyPlans.forEach(plan => {
      if (plan.day === selectedDay) {
        const activity = plan.activities.find(act => act.id === activityId);
        if (activity) {
          removedActivityCost = activity.cost || 0;
        }
      }
    });

    const updatedPlans = dailyPlans.map(plan => {
      if (plan.day === selectedDay) {
        return {
          ...plan,
          activities: plan.activities.filter(activity => activity.id !== activityId)
        };
      }
      return plan;
    });

    const oncekiPlanlar = dailyPlans;
    setDailyPlans(updatedPlans);

    try {
      const sonuc = await saveDailyPlans(updatedPlans);
      maliyetleriGuncelle(sonuc);
      setOriginalDailyPlans([...updatedPlans]);
      setHasChanges(false);
      toast.success(
        removedActivityCost > 0
          ? `Aktivite silindi (₺${removedActivityCost.toLocaleString('tr-TR')} azaldı)`
          : 'Aktivite silindi'
      );
    } catch (error) {
      setDailyPlans(oncekiPlanlar);
      logger.error("Aktivite silinemedi", error);
      toast.error(error instanceof Error ? error.message : 'Aktivite silinemedi');
    }
  };

  /**
   * Sunucunun döndürdüğü maliyetleri yerel duruma yansıtır.
   *
   * Sunucu (PUT /api/plan-detail/[id]) günlük plandaki aktivite
   * maliyetlerini bütçenin "aktiviteler" kategorisine yazıyor ve toplamları
   * yeniden hesaplıyor. Eskiden bu uç yalnızca `{id, gun_plani}` dönüyordu;
   * istemcideki `response.plan.total_cost` dalı hiç çalışmıyordu.
   */
  const maliyetleriGuncelle = (yanit: unknown) => {
    const plan = (yanit as { plan?: { total_cost?: number; daily_cost?: number } } | null)?.plan;
    if (!plan || plan.total_cost === undefined) return;

    setSelectedTrip(prev =>
      prev ? { ...prev, total_cost: plan.total_cost, daily_cost: plan.daily_cost ?? prev.daily_cost } : prev
    );

    setTrips(prev =>
      prev.map(trip =>
        trip.id === selectedTrip?.id
          ? { ...trip, total_cost: plan.total_cost, daily_cost: plan.daily_cost ?? trip.daily_cost }
          : trip
      )
    );
  };

  // Değişiklikleri kaydet
  const saveChanges = async () => {
    if (!selectedTrip) return;

    try {
      const yanit = await saveDailyPlans(dailyPlans);
      const yeniToplam = (yanit as { plan?: { total_cost?: number } } | null)?.plan?.total_cost;

      maliyetleriGuncelle(yanit);
      setOriginalDailyPlans([...dailyPlans]);
      setHasChanges(false);

      toast.success(
        typeof yeniToplam === 'number'
          ? `Değişiklikler kaydedildi! Toplam maliyet: ₺${yeniToplam.toLocaleString('tr-TR')}`
          : 'Değişiklikler kaydedildi!'
      );
    } catch (error) {
      logger.error("Değişiklikler kaydedilemedi", error);
      toast.error(error instanceof Error ? error.message : 'Değişiklikler kaydedilemedi');
    }
  };

  // Değişiklikleri iptal etme fonksiyonu
  const cancelChanges = () => {
    setDailyPlans([...originalDailyPlans]);
    setHasChanges(false);
    toast.success('Değişiklikler iptal edildi');
  };

  /**
   * Günlük planları kaydeder.
   *
   * DÜZELTİLEN HATA: bu fonksiyon eskiden hatayı yakalayıp `null` dönüyordu.
   * Çağıranlar (`addActivity`, `deleteActivity`) ise `try/catch` ile hata
   * BEKLİYORDU; hiç fırlatılmadığı için kaydetme başarısız olsa bile
   * "Aktivite eklendi ve kaydedildi" mesajı gösteriliyordu. Artık hata
   * yukarı fırlatılıyor.
   */
  /**
   * Günleri İLİŞKİSEL modele yazar (B4 · Adım 3).
   *
   * Uç gün bazlı (POST/PUT/DELETE), ekran ise toplu kaydediyor. Fark
   * `gunlukPlanFarkiCikar` ile çıkarılıyor; değişmeyen gün hiç istek
   * üretmiyor.
   *
   * SIRA: önce silme, sonra güncelleme, en son ekleme.
   *
   * Silmenin ÖNCE olması burada bütçedekinden daha kritik: şemada
   * `@@unique([tripId, date])` var. Bir gün ekrandan kaldırılıp aynı tarihe
   * yenisi konduğunda, ekleme önce yapılsaydı POST 409 ile düşerdi.
   *
   * ATOMİK DEĞİL: uçta toplu işlem yok. Bu yüzden çağıran hem başarıda hem
   * hatada listeyi sunucudan yeniden okuyor.
   */
  const iliskiselGunleriYaz = async (
    tripId: string,
    plans: DayPlan[]
  ): Promise<{ total_cost: number; daily_cost: number } | null> => {
    const sunucudakiler = await (async (): Promise<IliskiselGun[]> => {
      const yanit = await fetch(
        `/api/trip/daily-plans?tripId=${encodeURIComponent(tripId)}`
      );
      if (!yanit.ok) throw new Error('Günlük planlar okunamadı');
      const govde = await yanit.json();
      return Array.isArray(govde?.dailyPlans) ? govde.dailyPlans : [];
    })();

    const fark = gunlukPlanFarkiCikar(plans, sunucudakiler);

    // Tarihsiz gün eşitlenemez; sessizce atlamak "kaydedildi" deyip veri
    // kaybetmek olurdu.
    if (fark.tarihsiz.length > 0) {
      toast.error(
        `${fark.tarihsiz.join(', ')}. gün tarihsiz olduğu için kaydedilemedi`
      );
    }

    if (gunFarkiBosMu(fark)) return null;

    // Her yazma, seyahatin GÜNCEL bütçe toplamını `ozet` alanında
    // döndürüyor (B4 · Adım 5): uç, aktivite maliyetlerini bütçenin
    // "aktiviteler" kategorisine yansıttıktan sonra toplamı hesaplıyor.
    // Son başarılı yazmanınki geçerli olan.
    let ozet: { total_cost: number; daily_cost: number } | null = null;

    const kontrol = async (yanit: Response, mesaj: string) => {
      const govde = await yanit.json().catch(() => null);
      if (!yanit.ok) throw new Error(govde?.error || mesaj);
      if (govde?.ozet) ozet = govde.ozet;
    };

    for (const id of fark.silinecek) {
      await kontrol(
        await fetch(`/api/trip/daily-plans?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
        'Gün silinemedi'
      );
    }

    for (const gun of fark.guncellenecek) {
      await kontrol(
        await fetch('/api/trip/daily-plans', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: gun.id,
            date: gun.date,
            notes: gun.notes,
            activities: gun.activities,
          }),
        }),
        'Gün güncellenemedi'
      );
    }

    for (const gun of fark.eklenecek) {
      await kontrol(
        await fetch('/api/trip/daily-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId,
            date: gun.date,
            notes: gun.notes,
            activities: gun.activities,
          }),
        }),
        'Gün eklenemedi'
      );
    }

    return ozet;
  };

  const saveDailyPlans = async (plans: DayPlan[]) => {
    if (!selectedTrip) throw new Error('Seçili plan yok');

    // İLİŞKİSEL YOL (B4): taşınmış planda günler kendi tablolarına yazılıyor.
    if (iliskiselMi(selectedTrip)) {
      const ozet = await iliskiselGunleriYaz(selectedTrip.tripId, plans);

      // ÇİFT YAZMA KALDIRILDI (B4 · Adım 5).
      //
      // Buradan sonra bir de `PUT /api/plan-detail/[id]` çağrılıyordu; o uç
      // `gun_plani`nin yanı sıra aktivite maliyetlerini bütçeye yansıtıp
      // `total_cost`/`daily_cost` sütunlarını yeniden hesaplıyordu ve o
      // sütunlar üç ekranda okunuyordu. Artık AYNI KURAL ilişkisel uçta
      // işliyor (`aktiviteButcesiniEsitle`), üç ekran da toplamı sunucuda
      // `BudgetItem`lardan türetiyor. JSON sütunları salt okunur arşiv.
      //
      // Yanıt şekli korunuyor: `maliyetleriGuncelle` `plan.total_cost`
      // okuyor ve iki yol (taşınmış / taşınmamış) aynı çağrıyı paylaşıyor.
      return ozet ? { plan: ozet } : {};
    }

    const response = await fetch(`/api/plan-detail/${selectedTrip.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daily_plans: JSON.stringify(plans)
      })
    });

    if (!response.ok) {
      const hata = await response.json().catch(() => null);
      throw new Error(hata?.error || 'Plan kaydedilemedi');
    }

    return response.json();
  };

  // Seçili günün planı
  const selectedDayPlan = dailyPlans.find(plan => plan.day === selectedDay);

  // Loading durumu
  if (status === 'loading' || loading) {
    return (
      <SayfaKabugu>
        <Yukleniyor
          metin={status === 'loading' ? 'Oturum kontrol ediliyor…' : 'Günlük planlar yükleniyor…'}
        />
      </SayfaKabugu>
    );
  }

  // Giriş yapmamış kullanıcı
  if (status === 'unauthenticated') {
    return <GirisGerekli />;
  }

  if (error) {
    return <SayfaHatasi mesaj={error} yenidenDene={() => window.location.reload()} />;
  }

  return (
    <SayfaKabugu>
        {/* Başlık artık ortalanmıyor: ortalanmış başlık + ortalanmış açıklama
            + ortalanmış düğme sırası, uzun bir araç sayfasında okuma
            başlangıcını her seferinde yeniden aratıyordu. Sol hizalı başlık
            sayfanın nerede başladığını tek bakışta veriyor. */}
        <div className="mb-12">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] mb-3">
            Günlük plan
          </h1>
          <p className="text-[var(--fg-muted)] max-w-[62ch]">
            Seyahat planlarınızı gün gün düzenleyin ve aktivitelerinizi takip edin
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="text-center mb-8 flex justify-center space-x-4">
          <button
            onClick={() => router.push('/my-plans')}
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Planlarım
          </button>
          <button
            onClick={() => router.push('/budget')}
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Maliyet
          </button>
          <button
            onClick={() => router.push('/travel-mode')}
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-[var(--radius)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            + Yeni Plan Oluştur
          </button>
        </div>

        {/* Trip Selection */}
        {trips.length > 0 && (
          <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">Gezi Seçin</h2>
              {selectedTrip && (
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isPlanEditable(selectedTrip) 
                      ? 'bg-[var(--ok-soft)] text-[var(--ok)] dark:bg-[var(--ok-soft)] dark:text-[var(--ok)]'
                      : 'bg-[var(--surface-2)] text-[var(--fg)] dark:bg-[var(--surface-2)] dark:text-[var(--fg-muted)]'
                  }`}>
                    {isPlanEditable(selectedTrip) ? 'Düzenlenebilir' : 'Salt Okunur'}
                  </span>
                </div>
              )}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => {
                    setSelectedTrip(trip);
                    loadDailyPlans(trip);
                    setSelectedDay(1);
                  }}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    selectedTrip?.id === trip.id
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--line)] hover:border-[var(--line)]'
                  }`}
                >
                  <h3 className="font-[family-name:var(--font-serif)] text-[var(--fg)]">
                    {trip.city}, {trip.country}
                  </h3>
                  <p className="text-sm text-[var(--fg-muted)]">
                    {tarihAraligi(trip.startDate, trip.endDate)}
                  </p>
                  {trip.total_cost && (
                    <p className="text-sm font-medium text-[var(--accent)]">
                      Maliyet: ₺{trip.total_cost.toLocaleString('tr-TR')}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    {trip.budget_level && (
                      <p className="text-xs text-[var(--accent)]">
                        {trip.budget_level.charAt(0).toUpperCase() + trip.budget_level.slice(1)} • {trip.travel_style}
                      </p>
                    )}
                    <span className={`text-xs px-2 py-1 rounded ${
                      isPlanEditable(trip) 
                        ? 'bg-[var(--ok-soft)] text-[var(--ok)] dark:bg-[var(--ok-soft)] dark:text-[var(--ok)]'
                        : 'bg-[var(--surface-2)] text-[var(--fg-muted)] dark:bg-[var(--surface-2)] dark:text-[var(--fg-muted)]'
                    }`}>
                      {isPlanEditable(trip) ? 'Düzenlenebilir' : 'Salt Okunur'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedTrip && dailyPlans.length > 0 && (
          <>
            {/* Day Selection */}
            <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 mb-8">
              <h2 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)] mb-4">Gün Seçin</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                {dailyPlans.map((plan) => (
                  <button
                    key={plan.day}
                    onClick={() => setSelectedDay(plan.day)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      selectedDay === plan.day
                        ? 'border-[var(--accent)] bg-[var(--ok-soft)]'
                        : 'border-[var(--line)] hover:border-[var(--line)]'
                    }`}
                  >
                    <div className="font-medium text-[var(--fg)]">
                      {plan.day}. Gün
                    </div>
                    <div className="text-xs text-[var(--fg-muted)] mt-1">
                      {plan.date.split(' ')[0]} {plan.date.split(' ')[1]}
                    </div>
                    <div className="text-xs text-[var(--accent)] mt-1">
                      {plan.activities.length} aktivite
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Day Activities */}
            {selectedDayPlan && (
              <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                      {selectedDayPlan.day}. Gün - {selectedDayPlan.date}
                    </h2>
                    <p className="text-[var(--fg-muted)]">
                      {selectedDayPlan.activities.length} aktivite planlandı
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {isPlanEditable(selectedTrip) ? (
                      <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-[var(--accent)] text-[var(--accent-contrast)] px-4 py-2 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                      >
                        {showAddForm ? 'İptal' : '+ Aktivite Ekle'}
                      </button>
                    ) : (
                      <div className="text-sm text-[var(--fg-subtle)] bg-[var(--surface-2)] px-3 py-2 rounded-lg">
                        Bu plan salt okunur
                      </div>
                    )}
                  </div>
                </div>

                {/* Save/Cancel Buttons */}
                {hasChanges && (
                  <div className="mb-6 p-4 bg-[var(--accent-soft)] border border-transparent rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-[var(--info)] font-medium">
                          Kaydedilmemiş değişiklikler var
                        </span>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={cancelChanges}
                          className="px-4 py-2 bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--line-strong)] rounded-lg hover:bg-[var(--surface-3)] transition-colors"
                        >
                          İptal Et
                        </button>
                        <button
                          onClick={saveChanges}
                          className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                        >
                          Kaydet
                        </button>
                      </div>
                    </div>
                    
                    {/* Değişiklikler özeti */}
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-[var(--surface)] p-3 rounded-md">
                        <div className="font-medium text-[var(--fg-muted)]">Mevcut Toplam Maliyet</div>
                        <div className="font-[family-name:var(--font-serif)] text-xl text-[var(--accent)] sayisal">
                          ₺{selectedTrip?.total_cost?.toLocaleString('tr-TR') || '0'}
                        </div>
                      </div>
                      <div className="bg-[var(--surface)] p-3 rounded-md">
                        <div className="font-medium text-[var(--fg-muted)]">Tahmini Yeni Maliyet</div>
                        <div className="font-[family-name:var(--font-serif)] text-xl text-[var(--accent)] sayisal">
                          ₺{dailyPlans.reduce((sum, day) => {
                            return sum + day.activities.reduce((actSum, act) => actSum + (act.cost || 0), 0);
                          }, 0).toLocaleString('tr-TR')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Activity Form */}
                {showAddForm && isPlanEditable(selectedTrip) && (
                  <div className="bg-[var(--surface-2)] p-6 rounded-lg mb-6 border-2 border-dashed border-[var(--line-strong)]">
                    <h3 className="font-medium text-[var(--fg)] mb-4">Yeni Aktivite Ekle</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                          Aktivite Adı *
                        </label>
                        <input
                          type="text"
                          value={newActivity.name}
                          onChange={(e) => setNewActivity({...newActivity, name: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] dark:bg-[var(--surface)] dark:text-[var(--fg)]"
                          placeholder="Ör: Müze ziyareti"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                          Kategori
                        </label>
                        <select
                          value={newActivity.category}
                          onChange={(e) => setNewActivity({...newActivity, category: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] dark:bg-[var(--surface)] dark:text-[var(--fg)]"
                        >
                          <option value="aktiviteler">Aktiviteler</option>
                          <option value="yemek"> Yemek</option>
                          <option value="kültür">Kültür</option>
                          <option value="gezi">Gezi</option>
                          <option value="alışveriş">Alışveriş</option>
                          <option value="eğlence">Eğlence</option>
                          <option value="diğer">Diğer</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                          Konum
                        </label>
                        <input
                          type="text"
                          value={newActivity.location}
                          onChange={(e) => setNewActivity({...newActivity, location: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] dark:bg-[var(--surface)] dark:text-[var(--fg)]"
                          placeholder="Ör: Sultanahmet"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                          Maliyet (₺)
                        </label>
                        <input
                          type="number"
                          value={newActivity.cost}
                          onChange={(e) => setNewActivity({...newActivity, cost: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] dark:bg-[var(--surface)] dark:text-[var(--fg)]"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                          Başlangıç Saati *
                        </label>
                        <input
                          type="time"
                          value={newActivity.startTime}
                          onChange={(e) => setNewActivity({...newActivity, startTime: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] dark:bg-[var(--surface)] dark:text-[var(--fg)]"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                          Bitiş Saati *
                        </label>
                        <input
                          type="time"
                          value={newActivity.endTime}
                          onChange={(e) => setNewActivity({...newActivity, endTime: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] dark:bg-[var(--surface)] dark:text-[var(--fg)]"
                        />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                        Açıklama
                      </label>
                      <textarea
                        value={newActivity.description}
                        onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                        className="w-full px-3 py-2 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] dark:bg-[var(--surface)] dark:text-[var(--fg)]"
                        placeholder="Aktivite hakkında notlar..."
                        rows={3}
                      />
                    </div>
                    
                    <button
                      onClick={addActivity}
                      className="w-full bg-[var(--accent)] text-[var(--accent-contrast)] py-3 px-4 rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
                    >
                      Aktivite Ekle
                    </button>
                  </div>
                )}

                {/* Activities List */}
                {selectedDayPlan.activities.length === 0 ? (
                  <div className="text-center py-12">
                              <h3 className="text-xl font-medium text-[var(--fg)] mb-2">
                      Henüz Aktivite Yok
                    </h3>
                    <p className="text-[var(--fg-muted)]">
                      Bu güne ait ilk aktivitenizi ekleyerek başlayın.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDayPlan.activities
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((activity) => {
                        const timeOfDay = getTimeOfDay(activity.startTime);
                        return (
                          <div
                            key={activity.id}
                            className="rota-hat relative flex gap-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-kart)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-pop)]"
                          >
                            {/* Durak noktası: ana sayfadaki program listesiyle
                                aynı dil — gün bir rota, aktiviteler durak. */}
                            <span
                              className="mt-[7px] h-[11px] w-[11px] shrink-0 rounded-full border-2 border-[var(--route-vivid)] bg-[var(--surface)]"
                              aria-hidden="true"
                            />
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h4 className="font-medium text-[var(--fg)]">
                                    {activity.name}
                                  </h4>
                                  <span className="lejant text-[var(--route)]">
                                    {ZAMAN_ETIKETLERI[timeOfDay] ?? ''}
                                  </span>
                                  <span className="text-xs bg-[var(--surface-2)] text-[var(--fg-muted)] px-2 py-0.5 rounded-full border border-[var(--line)]">
                                    {KATEGORI_ETIKETLERI[activity.category] ?? activity.category}
                                  </span>
                                </div>
                                
                                <dl className="grid md:grid-cols-3 gap-x-4 gap-y-1 text-sm mb-2">
                                  <div className="flex gap-2">
                                    <dt className="lejant text-[var(--fg-subtle)] shrink-0">Saat</dt>
                                    <dd className="font-[family-name:var(--font-geist-mono)] text-[var(--fg)] sayisal">
                                      {activity.startTime}–{activity.endTime}
                                    </dd>
                                  </div>
                                  <div className="flex gap-2 min-w-0">
                                    <dt className="lejant text-[var(--fg-subtle)] shrink-0">Konum</dt>
                                    <dd className="text-[var(--fg-muted)] truncate">
                                      {activity.location || 'Belirtilmemiş'}
                                    </dd>
                                  </div>
                                  <div className="flex gap-2">
                                    <dt className="lejant text-[var(--fg-subtle)] shrink-0">Maliyet</dt>
                                    <dd className="font-[family-name:var(--font-geist-mono)] text-[var(--fg)] sayisal">
                                      ₺{activity.cost}
                                    </dd>
                                  </div>
                                </dl>
                                
                                {activity.description && (
                                  <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
                                    {activity.description}
                                  </p>
                                )}
                              </div>
                              
                              <div className="ml-4 flex flex-col space-y-2">
                                {isPlanEditable(selectedTrip) ? (
                                  <button
                                    onClick={() => deleteActivity(activity.id)}
                                    className="text-[var(--danger)] hover:text-[var(--danger)] p-1"
                                    title="Aktiviteyi Sil"
                                  >
                                    Sil
                                  </button>
                                ) : (
                                  <div className="text-[var(--fg-subtle)] p-1" title="Bu plan düzenlenemez">
                                    Salt okunur
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Day Summary */}
                {/* Gün özeti: zemin aksan DEĞİL. Üstündeki üç ölçüm
                    `--accent` ve `--fg` ile yazılıyordu; aksan zemin
                    üzerinde ikisi de okunmuyordu. */}
                {selectedDayPlan.activities.length > 0 && (
                  <div className="mt-6 p-4 bg-[var(--surface-2)] rounded-[var(--radius-lg)] border border-[var(--line)]">
                    <div className="grid md:grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="font-[family-name:var(--font-serif)] text-2xl text-[var(--accent)] sayisal">
                          {selectedDayPlan.activities.length}
                        </div>
                        <div className="text-sm text-[var(--fg-muted)]">Toplam Aktivite</div>
                      </div>
                      <div>
                        <div className="font-[family-name:var(--font-serif)] text-2xl text-[var(--accent)] sayisal">
                          ₺{selectedDayPlan.activities.reduce((sum, activity) => sum + activity.cost, 0)}
                        </div>
                        <div className="text-sm text-[var(--fg-muted)]">Günlük Maliyet</div>
                      </div>
                      <div>
                        <div className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)] sayisal">
                          {(() => {
                            if (selectedDayPlan.activities.length === 0) return '0h';
                            const totalMinutes = selectedDayPlan.activities.reduce((sum, activity) => {
                              const start = activity.startTime.split(':').map(Number);
                              const end = activity.endTime.split(':').map(Number);
                              return sum + (end[0] - start[0]) * 60 + (end[1] - start[1]);
                            }, 0);
                            return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
                          })()}
                        </div>
                        <div className="text-sm text-[var(--fg-muted)]">Toplam Süre</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {trips.length === 0 && (
          <div className="text-center py-16">
            <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">Henüz Plan Yok</h2>
            <p className="text-[var(--fg-muted)] mb-6">
              Günlük plan oluşturmak için önce bir seyahat planı oluşturun.
            </p>
            <button
              onClick={() => router.push('/travel-mode')}
              className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)]"
            >
              İlk Planınızı Oluşturun
            </button>
          </div>
        )}
    </SayfaKabugu>
  );
}







