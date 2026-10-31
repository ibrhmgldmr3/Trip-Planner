"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import { logger } from "@/lib/logger";
import {
  BagDugme,
  BosDurum,
  GirisGerekli,
  Kocan,
  KonturDoku,
  Olcum,
  Rozet,
  SayfaBasi,
  SayfaHatasi,
  SayfaKabugu,
  Yukleniyor,
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

  const kisaTarih = (dateString: string): string =>
    new Date(dateString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

  // Süre hesapla
  const calculateDuration = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff === 0 ? 1 : daysDiff;
  };

  if (status === 'loading' || loading) {
    return (
      <SayfaKabugu>
        <Yukleniyor
          metin={status === 'loading' ? 'Oturum kontrol ediliyor…' : 'Seyahatleriniz yükleniyor…'}
        />
      </SayfaKabugu>
    );
  }

  if (status === 'unauthenticated') {
    return <GirisGerekli />;
  }

  if (error) {
    return <SayfaHatasi mesaj={error} yenidenDene={() => window.location.reload()} />;
  }

  const toplamHarcama = trips.reduce((t, gezi) => t + (gezi.total_cost || 0), 0);
  const sehirSayisi = new Set(trips.map((t) => t.city)).size;

  return (
    <SayfaKabugu>
      <Toaster position="top-right" />

      <SayfaBasi
        baslik="Seyahat geçmişim"
        aciklama="Tamamlandı olarak işaretlediğiniz planlar burada bir kayıt olarak duruyor."
        yan={
          <div className="flex gap-2">
            <BagDugme href="/my-plans" tur="ikincil">
              Planlarım
            </BagDugme>
            <BagDugme href="/travel-mode">Yeni plan</BagDugme>
          </div>
        }
      />

      {trips.length === 0 ? (
        <BosDurum
          baslik="Henüz gerçekleşmiş seyahat yok"
          aciklama="Bir planı “Tamamlandı” olarak işaretlediğinizde buraya bir kayıt olarak eklenir."
          eylem={
            <>
              <BagDugme href="/my-plans">Planlarımı gör</BagDugme>
              <BagDugme href="/travel-mode" tur="ikincil">
                Yeni plan oluştur
              </BagDugme>
            </>
          }
        />
      ) : (
        <>
          {/*
            ÖZET ÖNCE. Eskiden sayfanın en altındaydı ve üç ayrı renkte
            kutuydu (yeşil / aksan / mor — biri ham Tailwind `bg-purple-50`).
            Kullanıcının bu sayfaya gelme sebebi tam da bu üç sayı; en üste
            alındı ve tek yüzeyde toplandı.
          */}
          <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] mb-8">
            <KonturDoku yogunluk={0.55} />
            <div className="relative grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)]">
              <Olcum
                etiket="Gerçekleşen seyahat"
                deger={trips.length.toLocaleString('tr-TR')}
                ton="aksan"
                className="px-6 py-5"
              />
              <Olcum
                etiket="Toplam harcama"
                deger={`₺${toplamHarcama.toLocaleString('tr-TR')}`}
                className="px-6 py-5"
              />
              <Olcum
                etiket="Gezilen şehir"
                deger={sehirSayisi.toLocaleString('tr-TR')}
                ton="rota"
                className="px-6 py-5"
              />
            </div>
          </div>

          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map((trip) => (
              <li
                key={trip.id}
                className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] transition-[border-color,box-shadow,transform] duration-200 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-pop)] hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3 p-5 pb-4">
                  <div className="min-w-0">
                    <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] leading-snug truncate">
                      {trip.city}
                      {trip.country && (
                        <span className="text-[var(--fg-muted)]">, {trip.country}</span>
                      )}
                    </h2>
                    <p className="text-sm text-[var(--fg-muted)] mt-1 sayisal">
                      {kisaTarih(trip.startDate)} – {kisaTarih(trip.endDate)}
                      {' · '}
                      {trip.duration || `${calculateDuration(trip.startDate, trip.endDate)} gün`}
                    </p>
                  </div>
                  {/* getStatusColor/getStatusText sabit değer döndüren iki
                      fonksiyondu; paylaşılan Rozet aynı işi yapıyor. */}
                  <Rozet ton="olumlu">Gerçekleşti</Rozet>
                </div>

                <div className="px-5">
                  <Kocan />
                </div>

                <div className="flex-1 p-5">
                  {trip.total_cost ? (
                    <Olcum
                      etiket="Harcama"
                      deger={`₺${trip.total_cost.toLocaleString('tr-TR')}`}
                      ton="aksan"
                    />
                  ) : (
                    <div>
                      <p className="lejant text-[var(--fg-subtle)]">Harcama</p>
                      <p className="text-sm text-[var(--fg-subtle)] mt-1.5">Kaydedilmemiş</p>
                    </div>
                  )}

                  {(trip.budget_level || trip.travel_style) && (
                    <ul className="flex flex-wrap gap-1.5 mt-4">
                      {trip.budget_level && (
                        <li>
                          <Rozet>
                            {trip.budget_level.charAt(0).toUpperCase() + trip.budget_level.slice(1)}
                          </Rozet>
                        </li>
                      )}
                      {trip.travel_style && (
                        <li>
                          <Rozet>{trip.travel_style}</Rozet>
                        </li>
                      )}
                    </ul>
                  )}

                  {trip.completedAt && (
                    <p className="lejant text-[var(--fg-subtle)] mt-5 sayisal">
                      Tamamlandı · {formatDate(trip.completedAt)}
                    </p>
                  )}
                </div>

                <div className="px-5 pb-5">
                  <BagDugme href={`/plan-detail/${trip.id}`} boy="sm" tur="ikincil" className="w-full">
                    Detayı gör
                  </BagDugme>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </SayfaKabugu>
  );
}
