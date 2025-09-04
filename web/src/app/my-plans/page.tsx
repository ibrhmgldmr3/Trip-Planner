'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { TripStatus } from '@prisma/client';
import { getTripStatus, getStatusLabel, getStatusColor, canCancel, canMarkAsDone } from '@/lib/trip-status';

interface SavedPlan {
  id: string;
  city: string;
  country: string | null;
  startDate: string;
  endDate: string;
  duration: string | null;
  total_cost: number | null;
  ai_model: string;
  createdAt: string;
  travel_style: string | null;
  user_id: string | null;
  status: TripStatus;
  completedAt: string | null;
  updatedAt: string;
}

export default function MyPlansPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tarihi geçmiş planları COMPLETED statüsüne geçir
  const checkAndUpdateExpiredPlans = useCallback(async (planList: SavedPlan[]): Promise<SavedPlan[]> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Bugünün başlangıcı
    
    const updatedPlans = [...planList];
    
    for (let i = 0; i < updatedPlans.length; i++) {
      const plan = updatedPlans[i];
      const endDate = new Date(plan.endDate);
      endDate.setHours(23, 59, 59, 999); // Gün sonuna set et
      
      // Eğer plan PLANNED veya ACTIVE statüsünde ve bitiş tarihi geçmişse
      if ((plan.status === 'PLANNED' || plan.status === 'ACTIVE') && endDate < today) {
        try {
          const response = await fetch('/api/plan-status', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ planId: plan.id, status: 'COMPLETED' }),
          });

          if (response.ok) {
            updatedPlans[i] = { ...plan, status: 'COMPLETED' as TripStatus };
          }
        } catch (error) {
          console.error('Error updating expired plan status:', error);
        }
      }
    }
    
    return updatedPlans;
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const response = await fetch('/api/my-plans');
      if (response.ok) {
        const data = await response.json();
        // Tarih kontrolü yaparak expired planları COMPLETED statüsüne geçir
        const updatedPlans = await checkAndUpdateExpiredPlans(data.plans);
        setPlans(updatedPlans);
      } else {
        setError('Planlar yüklenemedi');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Planlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [checkAndUpdateExpiredPlans]);

  useEffect(() => {
    if (status === 'loading') return; 
    
    if (status === 'unauthenticated') {
      toast.error('Bu sayfayı görüntülemek için giriş yapmanız gerekiyor');
      router.push('/login');
      return;
    }
    
    if (status === 'authenticated') {
      fetchPlans();
    }
  }, [status, router, fetchPlans]);

  const updatePlanStatus = async (planId: string, newStatus: TripStatus) => {
    try {
      console.log('Plan statüsü güncelleme başlatıldı:', { planId, newStatus });
      
      const response = await fetch('/api/plan-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId, status: newStatus }),
      });

      console.log('API Response Status:', response.status);
      console.log('API Response OK:', response.ok);

      if (response.ok) {
        const responseData = await response.json();
        console.log('? API Response Data:', responseData);
        
        toast.success(
          newStatus === TripStatus.CANCELLED ? 'Plan iptal edildi' :
          newStatus === TripStatus.DONE ? 'Plan tamamlandı ve Gezilerim\'e eklendi' :
          'Plan durumu güncellendi'
        );
        fetchPlans(); // Refresh the list
      } else {
        const errorData = await response.json();
        console.error('? API Error Response:', errorData);
        toast.error(errorData.error || 'Plan durumu güncellenemedi');
      }
    } catch (err) {
      console.error('Status update error:', err);
      toast.error('Plan durumu güncellenemedi');
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Bu planı silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`/api/my-plans/${planId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Plan silindi');
        setPlans(plans.filter(plan => plan.id !== planId));
      } else {
        toast.error('Plan silinemedi');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Plan silinemedi');
    }
  };

  const viewPlan = (planId: string) => {
    router.push(`/plan-detail/${planId}`);
  };

  // Session yükleniyor durumu
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {status === 'loading' ? 'Oturum kontrol ediliyor...' : 'Planlarınız yükleniyor...'}
          </p>
        </div>
      </div>
    );
  }

  // Kullanıcı giriş yapmamış
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Giriş Gerekli</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Bu sayfayı görüntülemek için önce giriş yapmanız gerekiyor.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 mr-4"
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Bir Hata Oluştu</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
            Seyahat Planlarım
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Kaydettiğiniz tüm seyahat planları
          </p>
        </div>

        {/* New Plan Button */}
        <div className="text-center mb-8">
          <button
            onClick={() => router.push('/travel-mode')}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            + Yeni Plan Oluştur
          </button>
        </div>

        {/* Plans Grid */}
        {plans.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Henüz Plan Yok
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              İlk seyahat planınızı oluşturmaya ne dersiniz?
            </p>
            <button
              onClick={() => router.push('/travel-mode')}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
            >
              Plan Oluştur
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => {
              const currentStatus = getTripStatus(
                new Date(plan.startDate), 
                new Date(plan.endDate), 
                plan.status
              );
              
              return (
              <div
                key={plan.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <div className="p-6">
                  {/* Plan Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                        {plan.city}
                        {plan.country && (
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                            {plan.country}
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {new Date(plan.startDate).toLocaleDateString('tr-TR')} - 
                        {new Date(plan.endDate).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(currentStatus)}`}>
                        {getStatusLabel(currentStatus)}
                      </span>
                      {plan.ai_model === 'manual_planning' ? (
                        <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded">
                          Manuel
                        </span>
                      ) : (
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded">
                          AI
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Plan Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Süre:</span>
                      <span className="font-medium">{plan.duration || 'Belirtilmemiş'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tarz:</span>
                      <span className="font-medium capitalize">{plan.travel_style || 'Standart'}</span>
                    </div>
                    {plan.total_cost && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Maliyet:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          ₺{plan.total_cost.toLocaleString('tr-TR')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Oluşturulma:</span>
                      <span className="text-xs">
                        {new Date(plan.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => viewPlan(plan.id)}
                        className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors duration-200 text-sm font-medium"
                      >
                        Görüntüle
                      </button>
                      <button
                        onClick={() => deletePlan(plan.id)}
                        className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors duration-200 text-sm font-medium"
                      >
                        Sil
                      </button>
                    </div>
                    
                    {/* Status Action Buttons */}
                    <div className="flex space-x-2">
                      {canCancel(currentStatus) && (
                        <button
                          onClick={() => updatePlanStatus(plan.id, TripStatus.CANCELLED)}
                          className="flex-1 bg-orange-500 text-white py-2 px-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 text-xs font-medium"
                        >
                          İptal Et
                        </button>
                      )}
                      {canMarkAsDone(currentStatus) && (
                        <button
                          onClick={() => updatePlanStatus(plan.id, TripStatus.DONE)}
                          className="flex-1 bg-purple-500 text-white py-2 px-3 rounded-lg hover:bg-purple-600 transition-colors duration-200 text-xs font-medium"
                        >
                          Tamamlandı
                        </button>
                      )}
                      
                      {/* COMPLETED planlar için özel butonlar */}
                      {currentStatus === TripStatus.COMPLETED && (
                        <>
                          <button
                            onClick={() => updatePlanStatus(plan.id, TripStatus.DONE)}
                            className="flex-1 bg-green-500 text-white py-2 px-3 rounded-lg hover:bg-green-600 transition-colors duration-200 text-xs font-medium"
                          >
                            ? Uygulandı
                          </button>
                          <button
                            onClick={() => updatePlanStatus(plan.id, TripStatus.CANCELLED)}
                            className="flex-1 bg-red-500 text-white py-2 px-3 rounded-lg hover:bg-red-600 transition-colors duration-200 text-xs font-medium"
                          >
                            ? İptal
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



