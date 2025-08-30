"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import { TripStatus } from '@prisma/client';

interface Trip {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  city: string;
  country: string | null;
  budget: number | null;
  status: TripStatus;
  createdAt: string;
  completedAt: string | null;
}

export default function MyTripsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchTrips = async () => {
    try {
      const response = await fetch('/api/my-trips');
      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips);
      } else {
        setError('Geziler yüklenemedi');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Geziler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async (tripId: string) => {
    if (!confirm('Bu geziyi silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`/api/my-trips/${tripId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Gezi silindi');
        setTrips(trips.filter(trip => trip.id !== tripId));
      } else {
        toast.error('Gezi silinemedi');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Gezi silinemedi');
    }
  };

  // Session yükleniyor durumu
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {status === 'loading' ? 'Oturum kontrol ediliyor...' : 'Gezileriniz yükleniyor...'}
          </p>
        </div>
      </div>
    );
  }

  // Kullanıcı giriş yapmamış
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
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
          <div className="text-6xl mb-4">😞</div>
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
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
            🌟 Gezilerim
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Tamamladığınız tüm seyahatler
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="text-center mb-8 flex justify-center space-x-4">
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

        {/* Trips Grid */}
        {trips.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Henüz Tamamlanmış Gezi Yok
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Planlarınızı tamamlayıp burada görebilirsiniz.
            </p>
            <button
              onClick={() => router.push('/my-plans')}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600"
            >
              Planlarıma Git
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <div className="p-6">
                  {/* Trip Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                        {trip.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {trip.city}
                        {trip.country && <span>, {trip.country}</span>}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(trip.startDate).toLocaleDateString('tr-TR')} - 
                        {new Date(trip.endDate).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs px-2 py-1 rounded-full">
                      Tamamlandı ✅
                    </span>
                  </div>

                  {/* Trip Details */}
                  <div className="space-y-2 mb-4">
                    {trip.description && (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {trip.description.length > 100 
                          ? `${trip.description.substring(0, 100)}...` 
                          : trip.description
                        }
                      </div>
                    )}
                    
                    {trip.budget && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Harcama:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          ₺{trip.budget.toLocaleString('tr-TR')}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tamamlandı:</span>
                      <span className="text-xs">
                        {trip.completedAt 
                          ? new Date(trip.completedAt).toLocaleDateString('tr-TR')
                          : new Date(trip.createdAt).toLocaleDateString('tr-TR')
                        }
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => router.push(`/trip-detail/${trip.id}`)}
                      className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors duration-200 text-sm font-medium"
                    >
                      Detayları Gör
                    </button>
                    <button
                      onClick={() => deleteTrip(trip.id)}
                      className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors duration-200 text-sm font-medium"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
