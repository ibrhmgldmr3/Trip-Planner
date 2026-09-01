"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import { logger } from "@/lib/logger";
import {
  GirisGerekli,
} from "@/components/ui";

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

  // Seyahatleri getir (sadece DONE statusündekiler)
  const fetchTrips = async () => {
    try {
      const response = await fetch('/api/my-trips?status=DONE');
      
      if (!response.ok) {
        throw new Error('Seyahatler yüklenemedi');
      }
      
      const data = await response.json();
      
      if (data.success && data.trips) {
        // Ekstra güvenlik için client-side'da da DONE olanları filtrele
        const doneTrips = data.trips.filter((trip: Trip) => trip.status === 'DONE');
        setTrips(doneTrips);
      } else {
        setTrips([]);
      }
    } catch (err) {
      logger.error("Seyahatler yüklenemedi", err);
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

  // Status rengi (DONE için özel renk)
  const getStatusColor = (): string => {
    return 'bg-[var(--ok-soft)] text-[var(--ok)] dark:bg-[var(--ok-soft)] dark:text-[var(--ok)]';
  };

  // Status text (DONE için özel text)
  const getStatusText = (): string => {
    return 'Gerçekleşti';
  };

  // Loading durumu
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-[var(--fg-muted)]">
            Seyahatler yükleniyor...
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
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">Bir Hata Oluştu</h2>
          <p className="text-[var(--fg-muted)] mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-2 rounded-lg hover:bg-[var(--accent-hover)]"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] mb-3">
             Gerçekleşen Seyahatlerim
          </h1>
          <p className="text-[var(--fg-muted)]">
            Başarıyla tamamladığınız seyahatlerinizin geçmişi
          </p>
        </div>

        {/* Navigation */}
        <div className="text-center mb-8 flex justify-center space-x-4">
          <button
            onClick={() => router.push('/profile')}
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Profile Dön
          </button>
          <button
            onClick={() => router.push('/my-plans')}
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Planlarım
          </button>
          <button
            onClick={() => router.push('/travel-mode')}
            className="bg-[var(--accent)] text-white px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            + Yeni Plan Oluştur
          </button>
        </div>

        {/* Trips List */}
        {trips.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
              Henüz Gerçekleştirilmiş Seyahat Yok
            </h2>
            <p className="text-[var(--fg-muted)] mb-6">
              Bir planı &quot;DONE&quot; olarak işaretlediğinizde buraya eklenir.
            </p>
            <button
              onClick={() => router.push('/my-plans')}
              className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] mr-4"
            >
              Planlarımı Gör
            </button>
            <button
              onClick={() => router.push('/travel-mode')}
              className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)]"
            >
              + Yeni Plan Oluştur
            </button>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] hover:shadow-xl transition-shadow overflow-hidden"
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                          {trip.city}
                        </h3>
                        {trip.country && (
                          <p className="text-sm text-[var(--fg-muted)]">
                            {trip.country}
                          </p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
                        {getStatusText()}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="mb-4">
                      <div className="flex items-center text-sm text-[var(--fg-muted)] mb-2">
                        <span>
                          {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-[var(--fg-muted)]">
                        <span>
                          {trip.duration || `${calculateDuration(trip.startDate, trip.endDate)} gün`}
                        </span>
                      </div>
                    </div>

                    {/* Budget & Style */}
                    {(trip.total_cost || trip.budget_level) && (
                      <div className="mb-4 space-y-2">
                        {trip.total_cost && (
                          <div className="flex items-center text-sm text-[var(--fg-muted)]">
                            <span>₺{trip.total_cost.toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                        {trip.budget_level && (
                          <div className="flex items-center text-sm text-[var(--fg-muted)]">
                            <span>
                              {trip.budget_level.charAt(0).toUpperCase() + trip.budget_level.slice(1)}
                              {trip.travel_style && ` • ${trip.travel_style}`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completion Date - liste yalnızca DONE planları içerdiği için
                        tek koşul completedAt alanının dolu olması */}
                    {trip.completedAt && (
                      <div className="mb-4">
                        <div className="flex items-center text-sm text-[var(--accent)]">
                          <span>Tamamlandı: {formatDate(trip.completedAt)}</span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => router.push(`/plan-detail/${trip.id}`)}
                        className="flex-1 bg-[var(--accent)] text-[var(--accent-contrast)] py-2 px-4 rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm"
                      >
                        Detay Görüntüle
                      </button>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div className="px-6 py-3 bg-[var(--surface-2)] border-t border-[var(--line)]">
                    <p className="text-xs text-[var(--fg-subtle)]">
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
            <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6">
              <h3 className="text-xl font-bold text-[var(--fg)] mb-6 text-center">
                Gerçekleştirilen Seyahat Özeti
              </h3>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-[var(--ok-soft)] rounded-lg">
                  <div className="text-2xl font-bold text-[var(--accent)]">
                    {trips.length}
                  </div>
                  <div className="text-sm text-[var(--fg-muted)]">Gerçekleşen Seyahat</div>
                </div>
                
                <div className="text-center p-4 bg-[var(--accent-soft)] rounded-lg">
                  <div className="text-2xl font-bold text-[var(--accent)]">
                    ₺{trips.reduce((sum, trip) => sum + (trip.total_cost || 0), 0).toLocaleString('tr-TR')}
                  </div>
                  <div className="text-sm text-[var(--fg-muted)]">Toplam Harcama</div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 dark:bg-[var(--surface-2)] rounded-lg">
                  <div className="text-2xl font-bold text-[var(--fg)]">
                    {Array.from(new Set(trips.map(t => t.city))).length}
                  </div>
                  <div className="text-sm text-[var(--fg-muted)]">Gezilen Şehir</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


