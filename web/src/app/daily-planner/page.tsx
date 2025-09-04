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
  budget_level?: string;
  travel_style?: string;
  duration?: number;
  gun_plani?: string; // JSON string of daily plans
  status?: string;
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

  // Plan düzenlenebilir mi kontrol et
  const isPlanEditable = (trip: Trip | null): boolean => {
    return trip?.status === 'PLANLANDI';
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

  // Planları parse et
  const parseDailyPlans = (plansJson: string): DayPlan[] => {
    try {
      // Önce JSON parse etmeyi dene
      const parsed = JSON.parse(plansJson);
      if (Array.isArray(parsed)) {
        return parsed.map((plan, index) => ({
          day: index + 1,
          date: plan.date || '',
          activities: plan.activities || [],
          notes: plan.notes || '',
          isEmpty: plan.isEmpty || false
        }));
      }
      return [];
    } catch (error) {
      console.log('JSON parse hatası, markdown formatında veri var:', error);
      
      // JSON parse edilemiyorsa, bu alan markdown formatında
      // Bu durumda boş planlar döndürelim
      return [];
    }
  };

  // Seçili trip için günlük planları yükle
  const loadDailyPlans = useCallback(async (trip: Trip) => {
    try {
      const response = await fetch(`/api/plan-detail/${trip.id}`);
      
      if (!response.ok) {
        throw new Error('Plan detayı yüklenemedi');
      }
      
      const data = await response.json();
      
      if (data.success && data.plan) {
        let plans: DayPlan[] = [];
        
        if (data.plan.gun_plani) {
          plans = parseDailyPlans(data.plan.gun_plani);
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
        setOriginalDailyPlans([...plans]); // Orijinal planları sakla
        setHasChanges(false); // Yeni plan yüklendiğinde değişiklik yok
      }
    } catch (err) {
      console.error('Daily plans fetch error:', err);
      toast.error('Günlük planlar yüklenemedi');
    }
  }, []);

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
  const addActivity = () => {
    if (!selectedTrip || !newActivity.name || !newActivity.startTime || !newActivity.endTime) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (!isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenemez. Sadece "PLANLANDI" statusündeki planlar düzenlenebilir.');
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
    setHasChanges(true); // Değişiklik var olarak işaretle
    
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
    toast.success('Aktivite eklendi (Kaydetmeyi unutmayın!)');
  };

  // Aktivite sil
  const deleteActivity = (activityId: string) => {
    if (!isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenemez. Sadece "PLANLANDI" statusündeki planlar düzenlenebilir.');
      return;
    }

    if (!confirm('Bu aktiviteyi silmek istediğinizden emin misiniz?')) return;

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
    setHasChanges(true); // Değişiklik var olarak işaretle
    toast.success('Aktivite silindi (Kaydetmeyi unutmayın!)');
  };

  // Değişiklikleri kaydet
  const saveChanges = async () => {
    if (!selectedTrip) return;

    try {
      await saveDailyPlans(dailyPlans);
      setOriginalDailyPlans([...dailyPlans]); // Orijinal planları güncelle
      setHasChanges(false);
      toast.success('Değişiklikler kaydedildi!');
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
    if (!selectedTrip) return;

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
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Plan kaydedilirken hata oluştu');
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
          <div className="text-6xl mb-4">●</div>
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
            💰 Maliyet
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
                    selectedTrip.status === 'PLANLANDI' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {selectedTrip.status === 'PLANLANDI' ? 'Düzenlenebilir' : 'Salt Okunur'}
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
                      trip.status === 'PLANLANDI' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {trip.status || 'PLANLANDI'}
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
                        ● Bu plan salt okunur
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
                          <option value="yemek">🍽️ Yemek</option>
                          <option value="kültür">Kültür</option>
                          <option value="gezi">Gezi</option>
                          <option value="alışveriş">🛍️ Alışveriş</option>
                          <option value="eğlence">Eğlence</option>
                          <option value="diğer">📝 Diğer</option>
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
                          Maliyet (₺)
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
                    <div className="text-6xl mb-4">📝</div>
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
                                    {categoryIcons[activity.category] || '📝'}
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
                                    <span className="font-medium">⏰ Saat:</span> {activity.startTime} - {activity.endTime}
                                  </div>
                                  <div>
                                    <span className="font-medium">📍 Konum:</span> {activity.location || 'Belirtilmemiş'}
                                  </div>
                                  <div>
                                    <span className="font-medium">💰 Maliyet:</span> ₺{activity.cost}
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
                                    ●
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
            <div className="text-6xl mb-4">🗓️</div>
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
