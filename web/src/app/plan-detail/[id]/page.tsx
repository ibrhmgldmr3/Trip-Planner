'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
// TripStatus @prisma/client'tan DEĞİL: bu bir client bileşeni.
import {
  TripStatus,
  getTripStatus,
  getStatusLabel,
  getStatusTone,
  canCancel,
  canMarkAsDone,
} from '@/lib/trip-status';
import { sanitizeHtml } from '@/lib/sanitize';
import { REZERV_ORANI } from '@/lib/plan-budget';
import { ButceDokumu, tl } from '@/components/ButceDokumu';
import {
  BagDugme,
  Damga,
  Dugme,
  Kocan,
  KonturDoku,
  Olcum,
  Rozet,
  SayfaHatasi,
  SayfaKabugu,
  Serit,
  Yukleniyor,
  cx,
} from '@/components/ui';
import { logger } from "@/lib/logger";

interface DayActivity {
  id?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  cost?: number;
  description?: string;
}

interface DayPlan {
  day: number;
  activities?: DayActivity[];
  notes?: string;
  isEmpty?: boolean;
}

interface ParsedDay {
  day: number;
  content: string;
  isEmpty?: boolean;
}

interface PlanDetail {
  id: string;
  city: string;
  country: string | null;
  /** Kalkış şehri (B6); eski planlarda ve yurt dışı planlarında null. */
  originCity: string | null;
  // API null döndürebiliyor; tip bunu saklarsa `new Date(null)` 1970 üretir.
  startDate: string | null;
  endDate: string | null;
  duration: string | null;
  total_cost: number | null;
  daily_cost: number | null;
  ai_model: string;
  createdAt: string;
  travel_style: string | null;
  budget_level: string | null;
  interests: string | null;
  accommodation: string | null;
  transportation: string | null;
  sehir_bilgisi: string | null;
  gun_plani: string | null;
  yemek_rehberi: string | null;
  pratik_bilgiler: string | null;
  butce_tahmini: string | null;
  raw_markdown: string | null;
  status: TripStatus;
  raw_html: string | null;
}

/**
 * Basit markdown → HTML. Modül düzeyinde: bileşen durumuna bağlı değil ve
 * `ButceDokumu`ya yedek olarak da geçiriliyor (eski markdown satırları).
 *
 * İçerik LLM tarafından üretilip DB'ye yazılıyor; ham HTML asla doğrudan
 * `dangerouslySetInnerHTML`'e verilmiyor.
 */
function formatContent(content: string | null): string | null {
  if (!content) return null;

  const html = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/###\s(.*?)\n/g, '<h3 class="text-lg font-semibold text-[var(--fg)] mt-4 mb-2">$1</h3>')
    .replace(/##\s(.*?)\n/g, '<h2 class="text-xl font-bold text-[var(--fg)] mt-6 mb-3">$1</h2>')
    .replace(/^\-\s(.*?)$/gm, '<li class="ml-4">• $1</li>')
    .replace(/\n/g, '<br />');

  return sanitizeHtml(html);
}

export default function PlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchPlanDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/plan-detail/${planId}`);
      
      if (!response.ok) {
        throw new Error('Plan bulunamadı');
      }
      
      const data = await response.json();
      setPlan(data.plan);
    } catch (err) {
      logger.error("Plan detayları yüklenemedi", err);
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const updatePlanStatus = async (newStatus: TripStatus) => {
    try {
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
        // Plan verisini yeniden yükle
        await fetchPlanDetail();
      } else {
        toast.error('Plan durumu güncellenemedi');
      }
    } catch (err) {
      logger.error("Plan durumu güncellenemedi", err);
      toast.error('Plan durumu güncellenemedi');
    }
  };

  useEffect(() => {
    if (planId) {
      fetchPlanDetail();
    }
  }, [planId, fetchPlanDetail]);

  const deletePlan = async () => {
    if (!confirm('Bu planı silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`/api/my-plans/${planId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Plan silindi');
        router.push('/my-plans');
      } else {
        toast.error('Plan silinemedi');
      }
    } catch (err) {
      logger.error("Plan silinemedi", err);
      toast.error('Plan silinemedi');
    }
  };

  const parseDailyPlan = (content: string | null) => {
    if (!content) return [];
    
    
    // "### Günlük Detaylı Program" başlığından sonrasını al
    let actualContent = content;
    const detailedProgramIndex = content.indexOf("### Günlük Detaylı Program");
    if (detailedProgramIndex !== -1) {
      // Başlığın bitiminden sonrasını al
      const afterTitle = content.substring(detailedProgramIndex + "### Günlük Detaylı Program".length);
      // İlk satır sonunu bul ve ondan sonrasını al
      const firstNewlineIndex = afterTitle.indexOf('\n');
      if (firstNewlineIndex !== -1) {
        actualContent = afterTitle.substring(firstNewlineIndex + 1);
      }
    }
    
    // Alternatif başlık kontrolü
    if (actualContent === content) {
      const gunlukProgramIndex = content.indexOf("## Günlük Program");
      if (gunlukProgramIndex !== -1) {
        const afterTitle = content.substring(gunlukProgramIndex + "## Günlük Program".length);
        const firstNewlineIndex = afterTitle.indexOf('\n');
        if (firstNewlineIndex !== -1) {
          actualContent = afterTitle.substring(firstNewlineIndex + 1);
        }
      }
    }

    
    // Önce JSON formatında olup olmadığını kontrol et
    try {
      const jsonData = JSON.parse(actualContent);
      if (Array.isArray(jsonData)) {
        return jsonData
          .filter((day: DayPlan) => day && typeof day === 'object')
          .map((day: DayPlan) => {
            let dayContent = '';
            
            // Aktiviteleri formatla
            if (day.activities && Array.isArray(day.activities) && day.activities.length > 0) {
              dayContent += '<h4 class="text-md font-semibold text-[var(--fg)] mb-3">Aktiviteler</h4>';
              dayContent += '<ul class="space-y-2 mb-4">';
              day.activities.forEach((activity: DayActivity) => {
                if (activity && typeof activity === 'object') {
                  dayContent += '<li class="flex items-start space-x-3 p-3 bg-[var(--accent-soft)] rounded-lg">';
                                    dayContent += '<div class="flex-1">';
                  if (activity.name) {
                    dayContent += `<h5 class="font-semibold text-[var(--fg)]">${activity.name}</h5>`;
                  }
                  if (activity.startTime || activity.endTime) {
                    dayContent += '<div class="text-sm text-[var(--fg-muted)] mt-1">';
                    if (activity.startTime) {
                      dayContent += `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--info-soft)] text-[var(--info)] mr-2">${activity.startTime}</span>`;
                    }
                    if (activity.endTime) {
                      dayContent += `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--surface-2)] text-[var(--fg)] dark:text-[var(--fg)]">${activity.endTime}</span>`;
                    }
                    dayContent += '</div>';
                  }
                  if (activity.description) {
                    dayContent += `<p class="text-[var(--fg-muted)] mt-2">${activity.description}</p>`;
                  }
                  if (activity.cost && activity.cost > 0) {
                    dayContent += `<div class="mt-2"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--ok-soft)] text-[var(--ok)]">${activity.cost}₺</span></div>`;
                  }
                  dayContent += '</div></li>';
                }
              });
              dayContent += '</ul>';
            } else {
              dayContent += '<div class="text-center py-8 text-[var(--fg-subtle)]">';
                            dayContent += '<p>Bu gün için henüz aktivite planlanmamış</p>';
              dayContent += '</div>';
            }
            
            // Notları formatla
            if (day.notes && day.notes.trim()) {
              dayContent += '<h4 class="text-md font-semibold text-[var(--accent)] mb-2 mt-4">Notlar</h4>';
              dayContent += `<div class="bg-[var(--surface-2)] p-3 rounded-[var(--radius)] border border-[var(--line)]"><p class="text-[var(--fg-muted)]">${day.notes}</p></div>`;
            }
            
            return {
              day: day.day || 1,
              content: dayContent,
              isEmpty: day.isEmpty || (!day.activities?.length && !day.notes?.trim())
            };
          })
          .sort((a: ParsedDay, b: ParsedDay) => a.day - b.day);
      }
    } catch {
      // JSON değilse, metin formatında parse etmeye devam et
    }
    
    // Gelişmiş metin formatı ayrıştırması
    const normalizedContent = actualContent.trim();
    
    // Çeşitli gün kalıplarını test et
    const dayPatterns = [
      // Tarih formatı: "#### 2025-09-01" veya "# 2025-09-01"
      /(?:^|\n)#+\s*(\d{4}-\d{2}-\d{2})\s*\n([\s\S]*?)(?=\n#+\s*\d{4}-\d{2}-\d{2}|\n#+\s*[^\d]|$)/g,
      // Gün formatı: "#### 1. Gün" veya "# 1. Gün"  
      /(?:^|\n)#+\s*(\d+)\.?\s*[Gg]ün\s*\n([\s\S]*?)(?=\n#+\s*\d+\.?\s*[Gg]ün|\n#+\s*[^\d]|$)/g,
      // Gün + Tarih: "#### 1 Eylül Pazartesi"
      /(?:^|\n)#+\s*(\d+)\s+[A-Za-zÇĞıİÖŞÜçğıiöşü]+\s+[A-Za-zÇĞıİÖŞÜçğıiöşü]+\s*\n([\s\S]*?)(?=\n#+\s*\d+\s+[A-Za-zÇĞıİÖŞÜçğıiöşü]|\n#+\s*[^\d]|$)/g,
      // Basit sayı formatı: "1." ile başlayan satırlar
      /(?:^|\n)(\d+)\.\s*\n([\s\S]*?)(?=\n\d+\.\s*\n|$)/g
    ];
    
    let days: Array<ParsedDay> = [];
    
    for (let i = 0; i < dayPatterns.length; i++) {
      const pattern = dayPatterns[i];
      const matches = [...normalizedContent.matchAll(pattern)];
      
      if (matches.length > 0) {
        
        days = matches.map(match => {
          let dayNumber = 1;
          
          if (i === 0) { // Tarih formatı
            const dateStr = match[1];
            const dayMatch = dateStr.match(/-(\d{2})$/);
            dayNumber = dayMatch ? parseInt(dayMatch[1]) : 1;
          } else if (i === 1 || i === 2) { // Gün numarası formatları
            dayNumber = parseInt(match[1]) || 1;
          } else { // Basit sayı formatı
            dayNumber = parseInt(match[1]) || 1;
          }
          
          const dayContent = match[2].trim();
          
          return {
            day: dayNumber,
            content: dayContent,
            isEmpty: !dayContent || dayContent.length < 10
          };
        }).filter(day => !day.isEmpty);
        
        if (days.length > 0) break;
      }
    }
    
    // Eğer hiçbir pattern çalışmazsa, alternatif yöntemler dene
    if (days.length === 0) {
      
      // --- ayırıcılarını kullanarak böl
      if (normalizedContent.includes('---')) {
        const sections = normalizedContent.split(/\n?\s*---\s*\n?/).filter(section => section.trim());
        
        if (sections.length > 1) {
          
          days = sections.map((section, index) => {
            // Bölümde gün numarası var mı kontrol et
            const dayMatch = section.match(/(\d+)\.?\s*gün/i);
            const dayNumber = dayMatch ? parseInt(dayMatch[1]) : index + 1;
            
            return {
              day: dayNumber,
              content: section.trim(),
              isEmpty: section.trim().length < 10
            };
          }).filter(day => day.content.length > 0);
        }
      }
      
      // Hâlâ başarısızsa, büyük paragrafları gün olarak say
      if (days.length === 0) {
        const paragraphs = normalizedContent
          .split(/\n\s*\n+/)
          .filter(p => p.trim().length > 50); // Çok kısa paragrafları atla
        
        if (paragraphs.length > 0) {
          
          days = paragraphs.map((paragraph, index) => ({
            day: index + 1,
            content: paragraph.trim(),
            isEmpty: false
          }));
        }
      }
    }
    
    // Günleri sırala ve boş olanları filtrele
    const sortedDays = days
      .filter(day => day.content && day.content.trim().length > 0)
      .sort((a, b) => a.day - b.day);
    
    
    return sortedDays;
  };

  const formatDayContent = (content: string) => {
    return sanitizeHtml(content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--accent)]">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-[var(--accent)]">$1</em>')
      .replace(/###\s(.*?)\n/g, '<h4 class="text-md font-semibold text-[var(--fg)] mt-3 mb-2">$1</h4>')
      .replace(/##\s(.*?)\n/g, '<h3 class="text-lg font-bold text-[var(--accent)] dark:text-[var(--accent)] mt-4 mb-2">$1</h3>')
      .replace(/^\-\s(.*?)$/gm, '<li class="flex items-start space-x-2 mb-1"><span class="text-[var(--accent)] mt-1">•</span><span>$1</span></li>')
      .replace(/(\d{1,2}:\d{2})/g, '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--info-soft)] text-[var(--info)] mr-2">$1</span>')
      .replace(/₺[\d,]+/g, '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--ok-soft)] text-[var(--ok)]">$&</span>')
      .replace(/\n/g, '<br />'));
  };

  if (loading) {
    return (
      <SayfaKabugu>
        <Yukleniyor metin="Plan detayları yükleniyor…" />
      </SayfaKabugu>
    );
  }

  if (error || !plan) {
    return (
      <SayfaHatasi
        mesaj={error ?? 'Bu plan bulunamadı ya da erişim izniniz yok.'}
        yenidenDene={() => window.location.reload()}
      />
    );
  }

  const guncelDurum = getTripStatus(
    plan.startDate ? new Date(plan.startDate) : null,
    plan.endDate ? new Date(plan.endDate) : null,
    plan.status
  );

  /**
   * İlgi alanları listesi.
   *
   * İki savunma var:
   *  1. `JSON.parse` ham DB içeriğinde patlayabiliyor; bozuk bir kayıt tüm
   *     sayfayı düşürmemeli.
   *  2. İÇ İŞARETÇİ SIZINTISI: manuel planlarda sunucu bu alanı
   *     `["manuel_planlama"]` ile dolduruyor ve bu, kullanıcıya gerçek bir
   *     ilgi alanıymış gibi rozet olarak görünüyordu. Alt çizgi taşıyan
   *     teknik değerler kullanıcıya ait değil.
   */
  const ilgiAlanlari: string[] = (() => {
    if (!plan.interests) return [];
    let ham: string[];
    try {
      const cozulen = JSON.parse(plan.interests) as unknown;
      ham = Array.isArray(cozulen) ? (cozulen as string[]) : [];
    } catch {
      ham = plan.interests.split(',');
    }
    return ham
      .map((i) => (typeof i === 'string' ? i.trim() : ''))
      .filter((i) => i.length > 0 && !i.includes('_'));
  })();

  const SEKMELER = [
    { id: 'overview', label: 'Genel bakış' },
    { id: 'city-info', label: 'Şehir bilgisi' },
    { id: 'daily-plan', label: 'Günlük plan' },
    { id: 'food-guide', label: 'Yemek rehberi' },
    { id: 'practical-info', label: 'Pratik bilgiler' },
    { id: 'budget', label: 'Maliyet' },
  ];

  /** Künye satırı: etiket solda lejant dilinde, değer sağda hizalı. */
  const Satir = ({ etiket, deger }: { etiket: string; deger: React.ReactNode }) => (
    <div className="flex items-baseline justify-between gap-3 py-2.5 border-b border-[var(--line)] last:border-b-0">
      <dt className="lejant text-[var(--fg-subtle)] shrink-0">{etiket}</dt>
      <dd className="text-[var(--fg)] text-right truncate">{deger}</dd>
    </div>
  );

  const bosMetin = (ne: string) => (
    <p className="text-[var(--fg-subtle)] py-8 text-center">
      Bu plan için {ne} mevcut değil.
    </p>
  );

  return (
    <SayfaKabugu>
      {/* ================================================================== */}
      {/* Belge başlığı                                                       */}
      {/* ================================================================== */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="group inline-flex items-center gap-1.5 py-2.5 -my-2.5 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {/* Unicode "←" yerine çizilmiş ikon. */}
          <svg
            className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H6M11 18l-6-6 6-6" />
          </svg>
          Geri
        </button>

        {/* Silme dolu kırmızı bir düğmeydi; yanlışlıkla tıklanması en pahalı
            olan eylem, en çok dikkat çeken biçim olmamalı. */}
        <Dugme tur="tehlike" boy="sm" onClick={deletePlan}>
          Planı sil
        </Dugme>
      </div>

      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] mb-6">
        <KonturDoku yogunluk={0.5} />

        <div className="relative p-6 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              {/* GÜZERGÂH (B6). Bir seyahat planı "Roma" değil, "İstanbul'dan
                  Roma'ya" demektir: bütçedeki ulaşım kalemi de bu güzergâha
                  göre hesaplanıyor, dolayısıyla kullanıcı rakamın neye
                  dayandığını başlıkta görebilmeli. */}
              {plan.originCity && (
                <p className="lejant text-[var(--route)] mb-1">
                  {plan.originCity} → {plan.city}
                </p>
              )}

              <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] leading-tight">
                {plan.city}
                {plan.country && (
                  <span className="text-[var(--fg-muted)]">, {plan.country}</span>
                )}
              </h1>

              <p className="text-[var(--fg-muted)] mt-2 sayisal">
                {plan.startDate && plan.endDate && (
                  <>
                    {new Date(plan.startDate).toLocaleDateString('tr-TR')} –{' '}
                    {new Date(plan.endDate).toLocaleDateString('tr-TR')}
                  </>
                )}
                {plan.duration && <span className="ml-2">· {plan.duration}</span>}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <Rozet ton={getStatusTone(guncelDurum)}>{getStatusLabel(guncelDurum)}</Rozet>
                <Rozet ton={plan.ai_model === 'manual_planning' ? 'notr' : 'aksan'}>
                  {plan.ai_model === 'manual_planning' ? 'Manuel plan' : 'Yapay zekâ planı'}
                </Rozet>
              </div>
            </div>

            {/* Tek bir plan, tek bir hüküm: damga burada hak ediliyor. */}
            <div className="flex flex-col items-end gap-5 shrink-0">
              <Damga ton={guncelDurum === TripStatus.DONE ? 'aksan' : 'muhur'}>
                {getStatusLabel(guncelDurum)}
              </Damga>

              <div className="flex flex-wrap justify-end gap-2">
                {canCancel(guncelDurum) && (
                  <Dugme
                    tur="ikincil"
                    boy="sm"
                    onClick={() => updatePlanStatus(TripStatus.CANCELLED)}
                  >
                    İptal et
                  </Dugme>
                )}
                {canMarkAsDone(guncelDurum) && (
                  <Dugme boy="sm" onClick={() => updatePlanStatus(TripStatus.DONE)}>
                    Tamamlandı
                  </Dugme>
                )}
              </div>
            </div>
          </div>

          {(plan.total_cost || plan.daily_cost) && (
            <>
              <div className="my-6">
                <Kocan />
              </div>
              <div className="flex flex-wrap gap-x-12 gap-y-4">
                {plan.total_cost != null && (
                  <Olcum
                    etiket="Toplam"
                    deger={`₺${plan.total_cost.toLocaleString('tr-TR')}`}
                    ton="aksan"
                  />
                )}
                {plan.daily_cost != null && (
                  <Olcum
                    etiket="Günlük"
                    deger={`₺${plan.daily_cost.toLocaleString('tr-TR')}`}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Sekmeler                                                            */}
      {/* ================================================================== */}
      <div
        role="tablist"
        aria-label="Plan bölümleri"
        className="flex gap-1 overflow-x-auto border-b border-[var(--line)] mb-6"
      >
        {SEKMELER.map((sekme) => {
          const aktif = activeTab === sekme.id;
          return (
            <button
              key={sekme.id}
              role="tab"
              type="button"
              aria-selected={aktif}
              onClick={() => setActiveTab(sekme.id)}
              className={cx(
                'relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-t',
                aktif
                  ? 'text-[var(--fg)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              )}
            >
              {sekme.label}
              {/* Aktif sekme: gezinme çubuğundaki "buradasınız" işaretinin
                  aynısı — macenta bir hat. */}
              {aktif && (
                <span
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[var(--route)]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ================================================================== */}
      {/* İçerik                                                              */}
      {/* ================================================================== */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-6 md:p-7">
        {activeTab === 'overview' && (
          <div>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)]">
              Plan özeti
            </h2>

            <div className="grid md:grid-cols-2 gap-x-10 gap-y-8 mt-6">
              <div>
                <p className="lejant text-[var(--route)] mb-3">Seyahat</p>
                <dl>
                  {plan.originCity && (
                    <Satir etiket="Kalkış" deger={plan.originCity} />
                  )}
                  <Satir etiket="Şehir" deger={plan.city} />
                  {plan.country && <Satir etiket="Ülke" deger={plan.country} />}
                  {plan.duration && <Satir etiket="Süre" deger={plan.duration} />}
                  {plan.travel_style && (
                    <Satir
                      etiket="Tarz"
                      deger={<span className="capitalize">{plan.travel_style}</span>}
                    />
                  )}
                  {/* `budget_level` sunucuda seyahat tarzıyla AYNI değerle
                      doldurulabiliyor (manuel planlarda öyle geliyor). Aynı
                      bilgiyi iki satırda göstermek künyeyi kirletiyor. */}
                  {plan.budget_level && plan.budget_level !== plan.travel_style && (
                    <Satir
                      etiket="Bütçe seviyesi"
                      deger={<span className="capitalize">{plan.budget_level}</span>}
                    />
                  )}
                </dl>
              </div>

              <div>
                <p className="lejant text-[var(--route)] mb-3">Künye</p>
                <dl>
                  {plan.total_cost != null && (
                    <Satir
                      etiket="Toplam maliyet"
                      deger={
                        <span className="sayisal text-[var(--accent)] font-medium">
                          ₺{plan.total_cost.toLocaleString('tr-TR')}
                        </span>
                      }
                    />
                  )}
                  {plan.daily_cost != null && (
                    <Satir
                      etiket="Günlük maliyet"
                      deger={
                        <span className="sayisal">
                          ₺{plan.daily_cost.toLocaleString('tr-TR')}
                        </span>
                      }
                    />
                  )}
                  <Satir
                    etiket="Oluşturma"
                    deger={
                      <span className="sayisal">
                        {new Date(plan.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    }
                  />
                  <Satir
                    etiket="Kaynak"
                    deger={plan.ai_model === 'manual_planning' ? 'Manuel' : 'Yapay zekâ'}
                  />
                </dl>
              </div>
            </div>

            {ilgiAlanlari.length > 0 && (
              <div className="mt-8">
                <p className="lejant text-[var(--route)] mb-3">İlgi alanları</p>
                <ul className="flex flex-wrap gap-1.5">
                  {ilgiAlanlari.map((ilgi, i) => (
                    <li key={`${ilgi}-${i}`}>
                      <Rozet ton="aksan">{ilgi}</Rozet>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'city-info' && (
          <div>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)] mb-5">
              Şehir bilgisi
            </h2>
            {plan.sehir_bilgisi ? (
              <div
                className="plan-govde"
                dangerouslySetInnerHTML={{ __html: formatContent(plan.sehir_bilgisi) || '' }}
              />
            ) : (
              bosMetin('şehir bilgisi')
            )}
          </div>
        )}

        {activeTab === 'daily-plan' && (
          <div>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)] mb-5">
              Günlük plan
            </h2>
            {plan.gun_plani ? (
              (() => {
                const gunler = parseDailyPlan(plan.gun_plani);

                if (gunler.length === 0) {
                  return (
                    <div
                      className="plan-govde"
                      dangerouslySetInnerHTML={{ __html: formatContent(plan.gun_plani) || '' }}
                    />
                  );
                }

                const dolu = gunler.filter((g) => !g.isEmpty).length;

                return (
                  <>
                    <ol className="space-y-4">
                      {gunler.map((gun, i) => (
                        /*
                          DÜZELTİLEN GÖRÜNMEZ METİN HATASI: dolu günlerin kartı
                          `bg-[var(--accent)]` (koyu teal) idi ama içindeki
                          başlık `text-[var(--fg)]` (koyu mürekkep) — koyu
                          üstüne koyu, okunmuyordu. Gün numarası dairesi de
                          aksan zemin üzerinde aksan renkliydi. Kart artık
                          normal yüzey; ayrım solundaki rota işaretinde.
                        */
                        <li
                          key={i}
                          className={cx(
                            'rounded-[var(--radius-lg)] border p-5 transition-colors',
                            gun.isEmpty
                              ? 'border-dashed border-[var(--line-strong)] bg-[var(--surface-2)]'
                              : 'border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)]'
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={cx(
                                'grid h-9 w-9 shrink-0 place-items-center rounded-full font-[family-name:var(--font-geist-mono)] text-sm font-semibold sayisal',
                                gun.isEmpty
                                  ? 'bg-[var(--surface-3)] text-[var(--fg-muted)]'
                                  : 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                              )}
                            >
                              {gun.day}
                            </span>

                            <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                              {gun.day}. Gün
                            </h3>

                            {plan.startDate && (
                              <span className="ml-auto text-sm text-[var(--fg-subtle)] sayisal">
                                {new Date(
                                  new Date(plan.startDate).getTime() +
                                    (gun.day - 1) * 24 * 60 * 60 * 1000
                                ).toLocaleDateString('tr-TR', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long',
                                })}
                              </span>
                            )}

                            {gun.isEmpty && <Rozet>Boş</Rozet>}
                          </div>

                          <div className="mt-4">
                            {gun.isEmpty ? (
                              <p className="text-[var(--fg-subtle)] text-sm">
                                Bu gün için henüz plan yapılmamış.
                              </p>
                            ) : (
                              <div
                                className="plan-govde"
                                dangerouslySetInnerHTML={{
                                  __html: formatDayContent(gun.content),
                                }}
                              />
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] bg-[var(--surface-2)] px-4 py-3">
                      <span className="lejant text-[var(--fg-subtle)]">
                        Toplam {gunler.length} gün
                      </span>
                      <span className="text-sm text-[var(--fg-muted)] sayisal">
                        {dolu} dolu · {gunler.length - dolu} boş
                      </span>
                    </div>
                  </>
                );
              })()
            ) : (
              bosMetin('günlük plan')
            )}
          </div>
        )}

        {activeTab === 'food-guide' && (
          <div>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)] mb-5">
              Yemek rehberi
            </h2>
            {plan.yemek_rehberi ? (
              <div
                className="plan-govde"
                dangerouslySetInnerHTML={{ __html: formatContent(plan.yemek_rehberi) || '' }}
              />
            ) : (
              bosMetin('yemek rehberi')
            )}
          </div>
        )}

        {activeTab === 'practical-info' && (
          <div>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)] mb-5">
              Pratik bilgiler
            </h2>
            {plan.pratik_bilgiler ? (
              <div
                className="plan-govde"
                dangerouslySetInnerHTML={{ __html: formatContent(plan.pratik_bilgiler) || '' }}
              />
            ) : (
              bosMetin('pratik bilgi')
            )}
          </div>
        )}

        {activeTab === 'budget' && (
          <div>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)] mb-5">
              Plan maliyeti
            </h2>

            {/*
              DÜZELTİLEN GÖRÜNMEZ METİN HATASI: üç maliyet kartı da
              `bg-[var(--accent)]` zemindeydi ve etiketleri
              `text-[var(--accent)]` ile yazılmıştı — yani "Toplam Maliyet"
              ve "Günlük Ortalama" etiketleri kendi zeminleriyle aynı renkti,
              hiç görünmüyordu. Değerler de teal üstünde yeşil/mavi idi.
              Üç ölçüm artık tek yüzeyde, ayrım çizgiyle.
            */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)] rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-2)] mb-8">
              <Olcum
                etiket="Toplam maliyet"
                deger={`₺${plan.total_cost ? plan.total_cost.toLocaleString('tr-TR') : '0'}`}
                ton="aksan"
                className="px-5 py-4"
              />
              <Olcum
                etiket="Günlük ortalama"
                deger={`₺${plan.daily_cost ? plan.daily_cost.toLocaleString('tr-TR') : '0'}`}
                className="px-5 py-4"
              />
              <div className="px-5 py-4">
                <Olcum
                  etiket="Önerilen bütçe"
                  // Katsayı elle `1.2` yazılıydı. `REZERV_ORANI` değişse bu
                  // kutu eski değerde kalır ve aynı sayfa iki farklı
                  // "önerilen bütçe" gösterirdi (aşağıdaki döküm katsayıyı
                  // kütüphaneden alıyor).
                  deger={tl(plan.total_cost ? plan.total_cost * REZERV_ORANI : 0)}
                  ton="rota"
                />
                <p className="text-xs text-[var(--fg-subtle)] mt-1.5">
                  %{Math.round((REZERV_ORANI - 1) * 100)} rezerv dâhil
                </p>
              </div>
            </div>

            {plan.butce_tahmini ? (
              <>
                <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)] mb-4">
                  Detaylı dağılım
                </h3>
                <ButceDokumu
                  raw={plan.butce_tahmini}
                  yedekHtml={formatContent(plan.butce_tahmini)}
                />

                <div className="mt-8">
                  <Serit ton="bilgi" baslik="Maliyetleri düzenlemek">
                    Her kalemi tek tek düzenlemek ve toplamı güncellemek için bütçe
                    sayfasına gidin.{' '}
                    <Link
                      href="/budget"
                      className="font-medium underline underline-offset-4"
                    >
                      Bütçeyi aç
                    </Link>
                  </Serit>
                </div>
              </>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] px-6 py-12 text-center">
                <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                  Maliyet detayı yok
                </h3>
                <p className="text-[var(--fg-muted)] mt-2 max-w-md mx-auto leading-relaxed">
                  Bu plan için kalem kalem maliyet bilgisi kaydedilmemiş.
                </p>
                <div className="mt-6">
                  <BagDugme href="/budget">Bütçe sayfasına git</BagDugme>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SayfaKabugu>
  );
}
