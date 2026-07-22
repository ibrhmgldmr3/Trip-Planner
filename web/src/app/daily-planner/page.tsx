"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

interface Activity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cost: number;
  description?: string;
  category: string;
  location: string;
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
  country: string;
  startDate: string;
  endDate: string;
  total_cost?: number;
  daily_cost?: number;
  budget_level?: string;
  travel_style?: string;
  duration?: number;
  gun_plani?: string; // JSON string of daily plans
  status?: string;
  travelers?: number;
}

// Aktivite kategorileri için simpler names
const categoryIcons: Record<string, string> = {
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

// Zaman dilimlerine göre modern renkler
const timeColors: Record<string, string> = {
  'morning': 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-700 shadow-yellow-100 dark:shadow-yellow-900/20',
  'noon': 'bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 border-blue-300 dark:border-blue-700 shadow-blue-100 dark:shadow-blue-900/20',
  'afternoon': 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700 shadow-green-100 dark:shadow-green-900/20',
  'evening': 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-300 dark:border-purple-700 shadow-purple-100 dark:shadow-purple-900/20'
};

// The parseMarkdownToPlans function has been moved inside the component

  // Plan düzenlenebilir mi kontrol et
  const isPlanEditable = (trip: Trip | null): boolean => {
    if (!trip) return false;

    // Sadece PLANNED durumundaki planlar düzenlenebilir
    if (trip.status !== 'PLANNED') return false;
    
    // İleri tarihli planlar düzenlenebilir (başlangıç tarihi bugünden sonra)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Sadece tarih karşılaştırması için saati sıfırla
    
    const startDate = new Date(trip.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Plan başlangıç tarihi bugün veya gelecekte ise düzenlenebilir
    return startDate >= today;
  };

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
    console.log('Starting advanced markdown parsing for daily plans');
    console.log('Content length:', markdownContent.length);
    
    const days: DayPlan[] = [];
    
    // Güvenli regex pattern'ler - sonsuz döngüyü önlemek için
    try {
      // İlk önce AI formatı deneyelim: #### 2025-09-05
      const aiDateMatches = [...markdownContent.matchAll(/#### (\d{4}-\d{2}-\d{2})/g)];
      console.log(`? Found ${aiDateMatches.length} AI date patterns`);
      
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
          console.log(`? Day ${dayNumber} content length: ${dayContent.length}`);
          
          // Aktiviteleri çıkar
          const activities = extractActivitiesFromMarkdown(dayContent);
          console.log(`? Extracted ${activities.length} activities for day ${dayNumber}`);
          
          days.push({
            day: dayNumber,
            date: dayDate,
            activities: activities,
            notes: dayContent,
            isEmpty: activities.length === 0
          });
        });
        
        console.log(`? Successfully parsed ${days.length} days using AI date format`);
        return days.sort((a, b) => a.day - b.day);
      }
      
      // AI formatı bulunamazsa, manuel gün formatı deneyelim: ### 1. Gün
      const dayMatches = [...markdownContent.matchAll(/### (\d+)\. Gün/g)];
      console.log(`? Found ${dayMatches.length} manual day patterns`);
      
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
        
        console.log(`? Successfully parsed ${days.length} days using manual day format`);
        return days.sort((a, b) => a.day - b.day);
      }
      
      // Hiçbir format bulunamazsa tek gün olarak işle
      console.log('No specific day format found, creating single day from content');
      const activities = extractActivitiesFromMarkdown(markdownContent);
      console.log(`? Created single day with ${activities.length} activities`);
      
      days.push({
        day: 1,
        date: '1. Gün',
        activities: activities,
        notes: markdownContent,
        isEmpty: activities.length === 0
      });
      
    } catch (error) {
      console.error('? Error parsing markdown:', error);
      // Hata durumunda boş gün döndür
      days.push({
        day: 1,
        date: '1. Gün',
        activities: [],
        notes: 'Parsing hatası oluştu',
        isEmpty: true
      });
    }
    
    console.log(`? Final result: ${days.length} days total`);
    return days;
  }, []);

  const parseDailyPlans = useCallback((plansJson: string): DayPlan[] => {
    console.log('? parseDailyPlans input:', plansJson);
    console.log('? parseDailyPlans input type:', typeof plansJson);
    
    try {
      // Önce JSON parse etmeyi dene
      const parsed = JSON.parse(plansJson);
      console.log('? JSON parse successful:', parsed);
      console.log('? Is array?', Array.isArray(parsed));
      
      if (Array.isArray(parsed)) {
        const result = parsed.map((plan, index) => ({
          day: index + 1,
          date: plan.date || '',
          activities: plan.activities || [],
          notes: plan.notes || '',
          isEmpty: plan.isEmpty || false
        }));
        console.log('? Mapped result:', result);
        return result;
      }
      return [];
    } catch (error) {
      console.log('? JSON parse hatası, markdown formatında veri var:', error);
      
      // JSON parse edilemiyorsa, markdown formatında olabilir
      // Bu durumda markdown'dan günlük planlar çıkarmaya çalış
      return parseMarkdownToPlans(plansJson);
    }
  }, [parseMarkdownToPlans]);

  // Markdown formatından günlük planları parse et


  // Markdown içeriğinden aktiviteleri çıkar
  const extractActivitiesFromMarkdown = (dayContent: string): Activity[] => {
    const activities: Activity[] = [];
    let activityId = 1;
    
    console.log(`? Extracting activities from ${dayContent.length} chars of content`);
    
    try {
      // İlk pattern: AI formatı - **Sabah (09:00 - 12:00):** formatı
      const timeBlockMatches = [...dayContent.matchAll(/- \*\*(\w+) \((\d{1,2}:\d{2}) - (\d{1,2}:\d{2})\):\*\*/g)];
      console.log(`? Found ${timeBlockMatches.length} time blocks`);
      
      if (timeBlockMatches.length > 0) {
        timeBlockMatches.forEach((match, index) => {
          const timeBlockName = match[1]; // Sabah, Öğle, Akşam vs.
          const startTime = match[2];
          const endTime = match[3];
          
          console.log(`? Processing time block: ${timeBlockName} (${startTime} - ${endTime})`);
          
          // Bu zaman bloğundan sonraki içeriği al
          const blockStartIndex = (match.index || 0) + match[0].length;
          const nextMatch = timeBlockMatches[index + 1];
          const blockEndIndex = nextMatch ? (nextMatch.index || dayContent.length) : dayContent.length;
          
          const blockContent = dayContent.slice(blockStartIndex, blockEndIndex);
          console.log(`? Block content length: ${blockContent.length}`);
          
          // Bu blok içindeki aktiviteleri bul
          const blockActivities = blockContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('-') && line.length > 3)
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(text => text.length > 0);
          
          console.log(`? Found ${blockActivities.length} activities in ${timeBlockName} block`);
          
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
            console.log(`? Added activity: ${activity.name} (${category})`);
          });
        });
        
        console.log(`? Total extracted activities from time blocks: ${activities.length}`);
        return activities;
      }
      
      // Eğer zaman blokları bulunamazsa, basit zaman formatını dene
      const timeMatches = [...dayContent.matchAll(/(\d{1,2}:\d{2})\s*[-:]?\s*([^\n]+)/g)];
      console.log(`? Found ${timeMatches.length} simple time patterns`);
      
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
            console.log(`? Added simple activity: ${description.substring(0, 30)}...`);
          }
        });
        
        console.log(`? Total extracted activities from time patterns: ${activities.length}`);
        return activities;
      }
      
      // Hala aktivite bulunamadıysa, sadece liste öğelerini al
      const lines = dayContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-') && line.length > 3)
        .slice(0, 20); // Maksimum 20 öğe al, sonsuz döngüyü önle
      
      console.log(`? Found ${lines.length} list items`);
      
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
          console.log(`? Added list activity: ${activityText.substring(0, 30)}...`);
        }
      });
      
    } catch (error) {
      console.error('? Error extracting activities:', error);
    }
    
    console.log(`? Total extracted activities: ${activities.length}`);
    return activities;
  };

  // Seçili trip için günlük planları yükle
  const loadDailyPlans = useCallback(async (trip: Trip) => {
    try {
      console.log('? Loading daily plans for trip:', trip.id, trip.city);
      const response = await fetch(`/api/plan-detail/${trip.id}`);
      
      if (!response.ok) {
        throw new Error('Plan detayı yüklenemedi');
      }
      
      const data = await response.json();
      console.log('? API Response data:', data);
      
      if (data.success && data.plan) {
        let plans: DayPlan[] = [];
        
        if (data.plan.gun_plani) {
          console.log('gun_plani data:', data.plan.gun_plani);
          console.log('gun_plani type:', typeof data.plan.gun_plani);
          
          // Eğer gun_plani string değilse (null, undefined vs), boş planlar oluştur
          if (typeof data.plan.gun_plani === 'string') {
            plans = parseDailyPlans(data.plan.gun_plani);
            plans = plans
              .map((p, idx) => ({ ...p, day: typeof p.day === 'number' && p.day > 0 ? p.day : idx + 1 }))
              .sort((a, b) => a.day - b.day);
            console.log('? Parsed plans:', plans);
          } else {
            console.log('gun_plani is not a string, creating empty plans');
          }
        } else {
          console.log('No gun_plani data found, creating empty plans');
        }
        
        // Eğer planlar boşsa veya parse edilemiyorsa, trip süresine göre boş planlar oluştur
        if (plans.length === 0) {
          console.log('? No plans found, creating empty plans for duration');
          const duration = getDuration(trip);
          console.log('Trip duration:', duration, 'days');
          plans = Array.from({ length: duration }, (_, index) => ({
            day: index + 1,
            date: formatDate(trip.startDate, index),
            activities: [],
            notes: '',
            isEmpty: false
          }));
          console.log('? Created empty plans:', plans);
        }
        
        setDailyPlans(plans);
        if (plans.length > 0) {
          setSelectedDay(plans[0].day);
        }
        setOriginalDailyPlans([...plans]); // Orijinal planları sakla
        setHasChanges(false); // Yeni plan yüklendiğinde değişiklik yok
      }
    } catch (err) {
      console.error('Daily plans fetch error:', err);
      toast.error('Günlük planlar yüklenemedi');
    }
  }, [parseDailyPlans]);

  // Kullanıcı planlarını getir
  const fetchUserTrips = useCallback(async () => {
    try {
      const response = await fetch('/api/my-plans');
      
      if (!response.ok) {
        throw new Error('Planlar yüklenemedi');
      }
      
      const data = await response.json();
      
      if (data.success && data.plans) {
        setTrips(data.plans);
        if (data.plans.length > 0) {
          setSelectedTrip(data.plans[0]);
          loadDailyPlans(data.plans[0]);
        }
      } else {
        setTrips([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Geziler yüklenemedi');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [loadDailyPlans]);

  // Trip süresini hesapla
  const getDuration = (trip: Trip): number => {
    if (trip.duration && trip.duration > 0) return trip.duration;
    
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Gidiş ve dönüş aynı gün ise 1 gün olarak hesapla
    return daysDiff === 0 ? 1 : daysDiff;
  };

  // Tarihi formatla
  const formatDate = (startDate: string, dayIndex: number): string => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex);
    return date.toLocaleDateString('tr-TR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
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
      toast.error('Bu plan düzenlenemez. Sadece "PLANLANDI" statusündeki ve gelecek tarihli planlar düzenlenebilir.');
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

    setDailyPlans(updatedPlans);
    try {
      await saveDailyPlans(updatedPlans);
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
    } catch {
      setHasChanges(true);
      toast.error('Aktivite eklendi ancak kaydedilemedi');
    }
  };

  // Aktivite sil
  const deleteActivity = async (activityId: string) => {
    if (!isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenemez. Sadece "PLANLANDI" statusündeki ve gelecek tarihli planlar düzenlenebilir.');
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

    setDailyPlans(updatedPlans);
    try {
      await saveDailyPlans(updatedPlans);
      setHasChanges(false);
      toast.success('Aktivite silindi (₺' + removedActivityCost + ' azaldı)');
    } catch {
      setHasChanges(true);
      toast.error('Aktivite silindi ancak kaydedilemedi');
    }
  };

  // Değişiklikleri kaydet
  const saveChanges = async () => {
    if (!selectedTrip) return;

    try {
      const response = await saveDailyPlans(dailyPlans);
      
      if (response && response.plan && response.plan.total_cost !== undefined) {
        // Seçili tripte toplam maliyeti güncelle
        setSelectedTrip(prev => ({
          ...prev!,
          total_cost: response.plan.total_cost,
          daily_cost: response.plan.daily_cost || prev?.daily_cost
        }));
        
        // Trips listesinde de seçili trip'in maliyetini güncelle
        setTrips(prev => prev.map(trip => 
          trip.id === selectedTrip.id 
            ? { 
                ...trip, 
                total_cost: response.plan.total_cost, 
                daily_cost: response.plan.daily_cost || trip.daily_cost 
              } 
            : trip
        ));
        
        toast.success(`Değişiklikler kaydedildi! Toplam Maliyet: ?${response.plan.total_cost.toLocaleString('tr-TR')}`);
      } else {
        toast.success('Değişiklikler kaydedildi!');
      }
      
      setOriginalDailyPlans([...dailyPlans]); // Orijinal planları güncelle
      setHasChanges(false);
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Değişiklikler kaydedilemedi');
    }
  };

  // Değişiklikleri iptal etme fonksiyonu
  const cancelChanges = () => {
    setDailyPlans([...originalDailyPlans]);
    setHasChanges(false);
    toast.success('Değişiklikler iptal edildi');
  };

  // Günlük planları kaydet
  const saveDailyPlans = async (plans: DayPlan[]) => {
    if (!selectedTrip) return null;

    try {
      const response = await fetch(`/api/plan-detail/${selectedTrip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_plans: JSON.stringify(plans)
        })
      });

      if (!response.ok) {
        throw new Error('Plan kaydedilemedi');
      }
      
      // Yanıtı JSON olarak dönüştür ve döndür
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Plan kaydedilirken hata oluştu');
      return null;
    }
  };

  // Seçili günün planı
  const selectedDayPlan = dailyPlans.find(plan => plan.day === selectedDay);

  // Loading durumu
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Günlük planlar yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  // Giriş yapmamış kullanıcı
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">?</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Giriş Gerekli</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Bu sayfayı görüntülemek için önce giriş yapmanız gerekiyor.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 mr-4"
          >
            Giriş Yap
          </button>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">!</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Bir Hata Oluştu</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
            Günlük Plan Yöneticisi
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Seyahat planlarınızı gün gün düzenleyin ve aktivitelerinizi takip edin
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="text-center mb-8 flex justify-center space-x-4">
          <button
            onClick={() => router.push('/my-plans')}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Planlarım
          </button>
          <button
            onClick={() => router.push('/budget')}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors"
          >
            ? Maliyet
          </button>
          <button
            onClick={() => router.push('/travel-mode')}
            className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-blue-700 transition-all"
          >
            + Yeni Plan Oluştur
          </button>
        </div>

        {/* Trip Selection */}
        {trips.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Gezi Seçin</h2>
              {selectedTrip && (
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isPlanEditable(selectedTrip) 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
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
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedTrip?.id === trip.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                  }`}
                >
                  <h3 className="font-bold text-gray-800 dark:text-white">
                    {trip.city}, {trip.country}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {new Date(trip.startDate).toLocaleDateString('tr-TR')} - 
                    {new Date(trip.endDate).toLocaleDateString('tr-TR')}
                  </p>
                  {trip.total_cost && (
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Maliyet: ₺{trip.total_cost.toLocaleString('tr-TR')}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    {trip.budget_level && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {trip.budget_level.charAt(0).toUpperCase() + trip.budget_level.slice(1)} • {trip.travel_style}
                      </p>
                    )}
                    <span className={`text-xs px-2 py-1 rounded ${
                      isPlanEditable(trip) 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Gün Seçin</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                {dailyPlans.map((plan) => (
                  <button
                    key={plan.day}
                    onClick={() => setSelectedDay(plan.day)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedDay === plan.day
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-green-300'
                    }`}
                  >
                    <div className="font-bold text-gray-800 dark:text-white">
                      {plan.day}. Gün
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      {plan.date.split(' ')[0]} {plan.date.split(' ')[1]}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {plan.activities.length} aktivite
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Day Activities */}
            {selectedDayPlan && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                      {selectedDayPlan.day}. Gün - {selectedDayPlan.date}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300">
                      {selectedDayPlan.activities.length} aktivite planlandı
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {isPlanEditable(selectedTrip) ? (
                      <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                      >
                        {showAddForm ? 'İptal' : '+ Aktivite Ekle'}
                      </button>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
                        ? Bu plan salt okunur
                      </div>
                    )}
                  </div>
                </div>

                {/* Save/Cancel Buttons */}
                {hasChanges && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                        <span className="text-blue-800 dark:text-blue-200 font-medium">
                          Kaydedilmemiş değişiklikler var
                        </span>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={cancelChanges}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          İptal Et
                        </button>
                        <button
                          onClick={saveChanges}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          Kaydet
                        </button>
                      </div>
                    </div>
                    
                    {/* Değişiklikler özeti */}
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white dark:bg-gray-700 p-3 rounded-md">
                        <div className="font-medium text-gray-700 dark:text-gray-300">Mevcut Toplam Maliyet</div>
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">
                          ₺{selectedTrip?.total_cost?.toLocaleString('tr-TR') || '0'}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-700 p-3 rounded-md">
                        <div className="font-medium text-gray-700 dark:text-gray-300">Tahmini Yeni Maliyet</div>
                        <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
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
                  <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6 border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <h3 className="font-medium text-gray-800 dark:text-white mb-4">Yeni Aktivite Ekle</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Aktivite Adı *
                        </label>
                        <input
                          type="text"
                          value={newActivity.name}
                          onChange={(e) => setNewActivity({...newActivity, name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                          placeholder="Ör: Müze ziyareti"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Kategori
                        </label>
                        <select
                          value={newActivity.category}
                          onChange={(e) => setNewActivity({...newActivity, category: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                        >
                          <option value="aktiviteler">Aktiviteler</option>
                          <option value="yemek"> Yemek</option>
                          <option value="kültür">Kültür</option>
                          <option value="gezi">Gezi</option>
                          <option value="alışveriş">Alışveriş</option>
                          <option value="eğlence">Eğlence</option>
                          <option value="diğer">? Diğer</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Konum
                        </label>
                        <input
                          type="text"
                          value={newActivity.location}
                          onChange={(e) => setNewActivity({...newActivity, location: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                          placeholder="Ör: Sultanahmet"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Maliyet (?)
                        </label>
                        <input
                          type="number"
                          value={newActivity.cost}
                          onChange={(e) => setNewActivity({...newActivity, cost: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Başlangıç Saati *
                        </label>
                        <input
                          type="time"
                          value={newActivity.startTime}
                          onChange={(e) => setNewActivity({...newActivity, startTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Bitiş Saati *
                        </label>
                        <input
                          type="time"
                          value={newActivity.endTime}
                          onChange={(e) => setNewActivity({...newActivity, endTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Açıklama
                      </label>
                      <textarea
                        value={newActivity.description}
                        onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                        placeholder="Aktivite hakkında notlar..."
                        rows={3}
                      />
                    </div>
                    
                    <button
                      onClick={addActivity}
                      className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors font-medium"
                    >
                      Aktivite Ekle
                    </button>
                  </div>
                )}

                {/* Activities List */}
                {selectedDayPlan.activities.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">?</div>
                    <h3 className="text-xl font-medium text-gray-800 dark:text-white mb-2">
                      Henüz Aktivite Yok
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
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
                            className={`p-4 rounded-lg border-2 ${timeColors[timeOfDay]}`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-xl">
                                    {categoryIcons[activity.category] || '?'}
                                  </span>
                                  <h4 className="font-bold text-gray-800 dark:text-white">
                                    {activity.name}
                                  </h4>
                                  <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                                    {activity.category}
                                  </span>
                                </div>
                                
                                <div className="grid md:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
                                  <div>
                                    <span className="font-medium">? Saat:</span> {activity.startTime} - {activity.endTime}
                                  </div>
                                  <div>
                                    <span className="font-medium">? Konum:</span> {activity.location || 'Belirtilmemiş'}
                                  </div>
                                  <div>
                                    <span className="font-medium">? Maliyet:</span> ₺{activity.cost}
                                  </div>
                                </div>
                                
                                {activity.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                                    {activity.description}
                                  </p>
                                )}
                              </div>
                              
                              <div className="ml-4 flex flex-col space-y-2">
                                {isPlanEditable(selectedTrip) ? (
                                  <button
                                    onClick={() => deleteActivity(activity.id)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Aktiviteyi Sil"
                                  >
                                    Sil
                                  </button>
                                ) : (
                                  <div className="text-gray-400 p-1" title="Bu plan düzenlenemez">
                                    ?
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
                {selectedDayPlan.activities.length > 0 && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="grid md:grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {selectedDayPlan.activities.length}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">Toplam Aktivite</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          ₺{selectedDayPlan.activities.reduce((sum, activity) => sum + activity.cost, 0)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">Günlük Maliyet</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
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
                        <div className="text-sm text-gray-600 dark:text-gray-300">Toplam Süre</div>
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
            <div className="text-6xl mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Henüz Plan Yok</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Günlük plan oluşturmak için önce bir seyahat planı oluşturun.
            </p>
            <button
              onClick={() => router.push('/travel-mode')}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600"
            >
              İlk Planınızı Oluşturun
            </button>
          </div>
        )}
      </div>
    </div>
  );
}







