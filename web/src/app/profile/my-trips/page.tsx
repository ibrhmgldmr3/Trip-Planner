"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

interface Trip {
  id: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  total_cost?: number;
  budget_level?: string;
  travel_style?: string;
  duration?: string;
  status: string;
  completedAt?: string;
  createdAt: string;
}

export default function MyTripsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // Seyahatleri getir
  const fetchTrips = async () => {
    try {
      const response = await fetch('/api/my-trips');
      
      if (!response.ok) {
        throw new Error('Seyahatler yüklenemedi');
      }
      
      const data = await response.json();
      
      if (data.success && data.trips) {
        setTrips(data.trips);
      } else {
        setTrips([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Seyahatler yüklenemedi');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      toast.error('Bu sayfayı görüntülemek için giriş yapmanız gerekiyor');
      router.push('/login');
      return;
    }
    
    if (status === 'authenticated') {
      fetchTrips();
    }
  }, [status, router]);

  // Filtrelenmiş seyahatler
  const filteredTrips = trips.filter(trip => {
    if (filter === 'all') return true;
    return trip.status.toLowerCase() === filter.toLowerCase();
  });

  // Tarih formatla
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Süre hesapla
  const calculateDuration = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff === 0 ? 1 : daysDiff;
  };

  // Status rengi
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'planned': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'completed': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  // Status text
  const getStatusText = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'planned': return 'Planlandı';
      case 'active': return 'Aktif';
      case 'completed': return 'Tamamlandı';
      case 'cancelled': return 'İptal Edildi';
      default: return status;
    }
  };

  // Loading durumu
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Seyahatler yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  // Giriş yapmamış kullanıcı
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
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
          <div className="text-6xl mb-4">😞</div>
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
            🗂️ Seyahat Geçmişim
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Geçmiş ve gelecek seyahatlerinizi görüntüleyin
          </p>
        </div>

        {/* Navigation */}
        <div className="text-center mb-8 flex justify-center space-x-4">
          <button
            onClick={() => router.push('/profile')}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors"
          >
            👤 Profile Dön
          </button>
          <button
            onClick={() => router.push('/my-plans')}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            📋 Planlarım
          </button>
          <button
            onClick={() => router.push('/travel-mode')}
            className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-blue-700 transition-all"
          >
            + Yeni Plan Oluştur
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'all', label: 'Tümü', count: trips.length },
                { key: 'planned', label: 'Planlandı', count: trips.filter(t => t.status.toLowerCase() === 'planned').length },
                { key: 'active', label: 'Aktif', count: trips.filter(t => t.status.toLowerCase() === 'active').length },
                { key: 'completed', label: 'Tamamlandı', count: trips.filter(t => t.status.toLowerCase() === 'completed').length },
                { key: 'cancelled', label: 'İptal Edildi', count: trips.filter(t => t.status.toLowerCase() === 'cancelled').length }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    filter === tab.key
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Trips List */}
        {filteredTrips.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">✈️</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              {filter === 'all' ? 'Henüz Seyahat Yok' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Seyahat Bulunamadı`}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {filter === 'all' 
                ? 'İlk seyahat planınızı oluşturarak başlayın.'
                : 'Bu kategoride seyahat bulunmuyor.'
              }
            </p>
            {filter === 'all' && (
              <button
                onClick={() => router.push('/travel-mode')}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
              >
                İlk Seyahatinizi Planlayın
              </button>
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                          {trip.city}
                        </h3>
                        {trip.country && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {trip.country}
                          </p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(trip.status)}`}>
                        {getStatusText(trip.status)}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="mb-4">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 mb-2">
                        <span className="mr-2">📅</span>
                        <span>
                          {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <span className="mr-2">⏱️</span>
                        <span>
                          {trip.duration || `${calculateDuration(trip.startDate, trip.endDate)} gün`}
                        </span>
                      </div>
                    </div>

                    {/* Budget & Style */}
                    {(trip.total_cost || trip.budget_level) && (
                      <div className="mb-4 space-y-2">
                        {trip.total_cost && (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <span className="mr-2">💰</span>
                            <span>₺{trip.total_cost.toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                        {trip.budget_level && (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <span className="mr-2">🎯</span>
                            <span>
                              {trip.budget_level.charAt(0).toUpperCase() + trip.budget_level.slice(1)}
                              {trip.travel_style && ` • ${trip.travel_style}`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completion Date */}
                    {trip.status.toLowerCase() === 'completed' && trip.completedAt && (
                      <div className="mb-4">
                        <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                          <span className="mr-2">✅</span>
                          <span>Tamamlandı: {formatDate(trip.completedAt)}</span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => router.push(`/plan-detail/${trip.id}`)}
                        className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors text-sm"
                      >
                        Detay Görüntüle
                      </button>
                      {trip.status.toLowerCase() === 'planned' && (
                        <button
                          onClick={() => router.push(`/daily-planner?plan=${trip.id}`)}
                          className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors text-sm"
                        >
                          Planla
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Created Date */}
                  <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Oluşturulma: {formatDate(trip.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {trips.length > 0 && (
          <div className="max-w-4xl mx-auto mt-12">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6 text-center">
                📊 Seyahat Özeti
              </h3>
              
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {trips.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Toplam Seyahat</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {trips.filter(t => t.status.toLowerCase() === 'completed').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Tamamlanan</div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    ₺{trips.reduce((sum, trip) => sum + (trip.total_cost || 0), 0).toLocaleString('tr-TR')}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Toplam Maliyet</div>
                </div>
                
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {Array.from(new Set(trips.map(t => t.city))).length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Farklı Şehir</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
