'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
// TripStatus bilinçli olarak @prisma/client'tan DEĞİL: bu bir client
// bileşeni ve Prisma runtime'ının tarayıcı bundle'ına girmesi istenmiyor.
import {
  TripStatus,
  getTripStatus,
  getStatusLabel,
  getStatusTone,
  canCancel,
  canMarkAsDone,
} from '@/lib/trip-status';
import { logger } from "@/lib/logger";
import {
  BagDugme,
  BosDurum,
  Dugme,
  GirisGerekli,
  Kart,
  Kocan,
  Olcum,
  Rozet,
  SayfaBasi,
  SayfaKabugu,
  Yukleniyor,
} from "@/components/ui";

interface SavedPlan {
  id: string;
  city: string;
  country: string | null;
  // API bu alanları null döndürebiliyor (tarihsiz plan). Tipin bunu
  // saklaması `new Date(null)` → 1970 hatasına yol açıyordu.
  startDate: string | null;
  endDate: string | null;
  duration: string | null;
  total_cost: number | null;
  ai_model: string;
  createdAt: string;
  travel_style: string | null;
  status: TripStatus;
  completedAt: string | null;
  updatedAt: string;
}

/** Tarihi güvenle çözer; null/boş/geçersiz girdide null döner. */
function tarihCoz(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** İki tarihi kullanıcıya gösterilecek aralığa çevirir. */
function tarihAraligi(start: string | null, end: string | null): string {
  const bas = tarihCoz(start);
  const bit = tarihCoz(end);

  if (!bas && !bit) return 'Tarih belirtilmemiş';
  if (bas && bit) {
    return `${bas.toLocaleDateString('tr-TR')} - ${bit.toLocaleDateString('tr-TR')}`;
  }
  return (bas ?? bit)!.toLocaleDateString('tr-TR');
}

export default function MyPlansPage() {
  const router = useRouter();
  const { status } = useSession();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Bitiş tarihi geçmiş planları COMPLETED'a çeker.
   *
   * DÜZELTİLEN HATA: eskiden `new Date(plan.endDate)` doğrudan çağrılıyordu.
   * `endDate` null olan planlarda bu 1970-01-01 üretiyor, koşul her zaman
   * doğru çıkıyor ve TARİHSİZ HER PLAN sayfa açılır açılmaz "Tamamlandı"
   * olarak işaretleniyordu. Artık tarihi çözülemeyen planlara dokunulmuyor.
   *
   * İkinci düzeltme: istekler sırayla atılıyordu; 20 süresi geçmiş plan
   * 20 ardışık tur demekti. Artık paralel.
   */
  const checkAndUpdateExpiredPlans = useCallback(async (planList: SavedPlan[]): Promise<SavedPlan[]> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Bugünün başlangıcı

    const suresiGecenler = planList.filter((plan) => {
      if (plan.status !== TripStatus.PLANNED && plan.status !== TripStatus.ACTIVE) {
        return false;
      }

      const bitis = tarihCoz(plan.endDate);
      if (!bitis) return false; // Tarihsiz plan otomatik tamamlanmaz.

      bitis.setHours(23, 59, 59, 999);
      return bitis < today;
    });

    if (suresiGecenler.length === 0) return planList;

    const guncellenenler = new Set<string>();

    await Promise.all(
      suresiGecenler.map(async (plan) => {
        try {
          const response = await fetch(`/api/trip-plans/${plan.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: TripStatus.COMPLETED }),
          });

          if (response.ok) guncellenenler.add(plan.id);
        } catch (error) {
          logger.error("Süresi geçmiş plan statüsü güncellenemedi", error);
        }
      })
    );

    if (guncellenenler.size === 0) return planList;

    return planList.map((plan) =>
      guncellenenler.has(plan.id) ? { ...plan, status: TripStatus.COMPLETED } : plan
    );
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const response = await fetch('/api/my-plans');
      if (response.ok) {
        const data = await response.json();
        // API şekli beklenenden farklı gelirse (hata gövdesi, boş yanıt)
        // `data.plans` undefined oluyor ve alt akış patlıyordu.
        const gelenPlanlar: SavedPlan[] = Array.isArray(data?.plans) ? data.plans : [];
        // Tarih kontrolü yaparak expired planları COMPLETED statüsüne geçir
        const updatedPlans = await checkAndUpdateExpiredPlans(gelenPlanlar);
        setPlans(updatedPlans);
      } else {
        setError('Planlar yüklenemedi');
      }
    } catch (err) {
      logger.error("Planlar yüklenemedi", err);
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
      
      // Tek kanonik durum ucu. `PUT /api/plan-status` Aşama 1'de kaldırıldı:
      // iki uç aynı işi farklı yapıyor ve bu sayfa ile plan detayı sayfası
      // aynı butona farklı sonuç veriyordu.
      const response = await fetch(`/api/trip-plans/${planId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });


      if (response.ok) {
        toast.success(
          newStatus === TripStatus.CANCELLED ? 'Plan iptal edildi' :
          newStatus === TripStatus.DONE ? 'Plan tamamlandı ve Gezilerim\'e eklendi' :
          'Plan durumu güncellendi'
        );
        fetchPlans(); // Refresh the list
      } else {
        const errorData = await response.json();
        logger.error("Plan durumu güncellenemedi", undefined, { status: response.status });
        toast.error(errorData.error || 'Plan durumu güncellenemedi');
      }
    } catch (err) {
      logger.error("Plan durumu güncellenemedi", err);
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
      logger.error("Plan silinemedi", err);
      toast.error('Plan silinemedi');
    }
  };

  const viewPlan = (planId: string) => {
    router.push(`/plan-detail/${planId}`);
  };

  if (status === 'loading' || loading) {
    return (
      <SayfaKabugu>
        <Yukleniyor
          metin={status === 'loading' ? 'Oturum kontrol ediliyor…' : 'Planlarınız yükleniyor…'}
        />
      </SayfaKabugu>
    );
  }

  if (status === 'unauthenticated') {
    return <GirisGerekli />;
  }

  if (error) {
    return (
      <SayfaKabugu genislik="dar">
        <BosDurum
          baslik="Planlar yüklenemedi"
          aciklama={error}
          eylem={<Dugme onClick={() => window.location.reload()}>Tekrar dene</Dugme>}
        />
      </SayfaKabugu>
    );
  }

  return (
    <SayfaKabugu>
      <SayfaBasi
        baslik="Seyahat planlarım"
        aciklama={
          plans.length > 0
            ? `${plans.length} kayıtlı plan`
            : 'Kaydettiğiniz planlar burada listelenir.'
        }
        yan={<BagDugme href="/travel-mode">Yeni plan</BagDugme>}
      />

      {plans.length === 0 ? (
        <BosDurum
          baslik="Henüz bir planınız yok"
          aciklama="İlk planınızı oluşturun; şehir ve tarihleri girmeniz yeterli, gerisini biz hazırlayalım."
          eylem={<BagDugme href="/travel-mode">Plan oluştur</BagDugme>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => {
            // Tarihsiz planlarda `new Date(null)` 1970 üretiyor ve plan
            // "Tamamlandı" görünüyordu; artık tarih çözülemezse kayıtlı
            // durum olduğu gibi gösteriliyor.
            const currentStatus = getTripStatus(
              tarihCoz(plan.startDate),
              tarihCoz(plan.endDate),
              plan.status
            );

            /* Her kart bir BELGE: üst bilgi, koçan ayracı, ölçüm, künye.
               Listede damga değil rozet kullanılıyor — on iki kartın her
               birinde eğik bir damga arayüzü huzursuz gösterirdi. */
            return (
              <Kart key={plan.id} etkilesimli className="flex flex-col">
                <div className="flex items-start justify-between gap-3 p-5 pb-4">
                  <div className="min-w-0">
                    <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] leading-snug truncate">
                      {plan.city}
                      {plan.country && (
                        <span className="text-[var(--fg-muted)]">, {plan.country}</span>
                      )}
                    </h2>
                    <p className="text-sm text-[var(--fg-muted)] mt-1 sayisal">
                      {tarihAraligi(plan.startDate, plan.endDate)}
                    </p>
                  </div>
                  <Rozet ton={getStatusTone(currentStatus)}>
                    {getStatusLabel(currentStatus)}
                  </Rozet>
                </div>

                <div className="px-5">
                  <Kocan />
                </div>

                <div className="p-5 flex-1">
                  {/* Maliyet kartın en önemli sayısı: ölçüm olarak duruyor.
                      `total_cost` 0 olabilir; truthy kontrolü sıfır bütçeli
                      planı "hesaplanmamış" gösteriyordu. */}
                  {plan.total_cost != null ? (
                    <Olcum
                      etiket="Toplam bütçe"
                      deger={`₺${plan.total_cost.toLocaleString('tr-TR')}`}
                      ton="aksan"
                    />
                  ) : (
                    <div>
                      <p className="lejant text-[var(--fg-subtle)]">Toplam bütçe</p>
                      <p className="text-sm text-[var(--fg-subtle)] mt-1.5">Hesaplanmamış</p>
                    </div>
                  )}

                  {/* Künye: etiketler lejant dilinde, değerler sağda hizalı.
                      Göz etiketleri atlayıp değerleri tarayabiliyor. */}
                  <dl className="mt-5 space-y-2 text-sm">
                    {[
                      { etiket: 'Süre', deger: plan.duration || 'Belirtilmemiş' },
                      { etiket: 'Tarz', deger: plan.travel_style || 'Standart', buyukHarf: true },
                      {
                        etiket: 'Oluşturulma',
                        deger: new Date(plan.createdAt).toLocaleDateString('tr-TR'),
                      },
                      {
                        etiket: 'Kaynak',
                        deger: plan.ai_model === 'manual_planning' ? 'Manuel' : 'Yapay zekâ',
                      },
                    ].map((satir) => (
                      <div key={satir.etiket} className="flex items-baseline justify-between gap-3">
                        <dt className="lejant text-[var(--fg-subtle)] shrink-0">{satir.etiket}</dt>
                        <dd
                          className={
                            satir.buyukHarf
                              ? 'text-[var(--fg)] capitalize text-right truncate'
                              : 'text-[var(--fg)] text-right truncate sayisal'
                          }
                        >
                          {satir.deger}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="px-5 pb-5 flex flex-wrap items-center gap-2">
                  <Dugme boy="sm" onClick={() => viewPlan(plan.id)}>
                    Görüntüle
                  </Dugme>

                  {canCancel(currentStatus) && (
                    <Dugme
                      boy="sm"
                      tur="ikincil"
                      onClick={() => updatePlanStatus(plan.id, TripStatus.CANCELLED)}
                    >
                      İptal et
                    </Dugme>
                  )}
                  {canMarkAsDone(currentStatus) && (
                    <Dugme
                      boy="sm"
                      tur="ikincil"
                      onClick={() => updatePlanStatus(plan.id, TripStatus.DONE)}
                    >
                      Tamamlandı
                    </Dugme>
                  )}
                  {currentStatus === TripStatus.COMPLETED && (
                    <Dugme
                      boy="sm"
                      tur="ikincil"
                      onClick={() => updatePlanStatus(plan.id, TripStatus.DONE)}
                    >
                      Uygulandı
                    </Dugme>
                  )}

                  {/* Yıkıcı eylem en sona ve en sessiz biçime: yanlışlıkla
                      tıklanması en pahalı olan düğme, en çok dikkat çeken
                      kırmızı dolgu olmamalı. */}
                  <Dugme
                    boy="sm"
                    tur="tehlike"
                    className="ml-auto"
                    onClick={() => deletePlan(plan.id)}
                  >
                    Sil
                  </Dugme>
                </div>
              </Kart>
            );
          })}
        </div>
      )}
    </SayfaKabugu>
  );
}
