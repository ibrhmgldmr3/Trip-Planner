'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { TripStatus } from '@prisma/client';
import { getTripStatus, getStatusLabel, getStatusColor, canCancel, canMarkAsDone } from '@/lib/trip-status';
import { sanitizeHtml } from '@/lib/sanitize';

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
  startDate: string;
  endDate: string;
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
      console.error('Plan detayları yüklenirken hata:', err);
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
      console.error('Status update error:', err);
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
      console.error('Delete error:', err);
      toast.error('Plan silinemedi');
    }
  };

  const formatContent = (content: string | null) => {
    if (!content) return null;

    // Markdown formatını basic HTML'e çevir.
    const html = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/###\s(.*?)\n/g, '<h3 class="text-lg font-semibold text-gray-800 dark:text-white mt-4 mb-2">$1</h3>')
      .replace(/##\s(.*?)\n/g, '<h2 class="text-xl font-bold text-gray-800 dark:text-white mt-6 mb-3">$1</h2>')
      .replace(/^\-\s(.*?)$/gm, '<li class="ml-4">• $1</li>')
      .replace(/\n/g, '<br />');

    // İçerik LLM tarafından üretilip DB'ye yazılıyor; ham HTML'i asla
    // doğrudan dangerouslySetInnerHTML'e vermiyoruz.
    return sanitizeHtml(html);
  };

  // Render budget details as HTML string if JSON is provided; fallback to formatted content
  const renderBudgetHtml = (raw: string | null) => {
    if (!raw) return null;
    try {
      type BudgetItem = { description?: string; amount?: number; isPaid?: boolean };
      type BudgetCategory = { items?: Array<BudgetItem>; total?: number };
      type BudgetData = {
        categories?: Record<string, BudgetCategory>;
        Categories?: Record<string, BudgetCategory>;
        totalCostWithExtras?: number;
        extraItemsTotal?: number;
        suggestedBudget?: number;
      };
      const data = JSON.parse(raw as string) as BudgetData;
      const categories = (data && (data.categories || data.Categories)) as Record<string, BudgetCategory> | undefined;
      const extraItemsTotal = Number(data?.totalCostWithExtras ?? data?.extraItemsTotal ?? 0) || 0;
      const suggested = Number(data?.suggestedBudget ?? 0) || 0;

      if (categories && typeof categories === 'object') {
        const entries = Object.entries(categories) as Array<[string, { items?: Array<{ description?: string; amount?: number; isPaid?: boolean }>; total?: number }]>;
        const sumFromCats = entries.reduce((acc, [, v]) => acc + Number(v?.total ?? 0), 0);
        const grandTotal = extraItemsTotal > 0 ? extraItemsTotal : sumFromCats;

        let html = '';
        // Summary cards
        html += '<div class="grid md:grid-cols-3 gap-6 mb-4">';
        html += '<div class="p-4 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">'
              + '<div class="text-sm font-medium text-green-700 dark:text-green-300">Toplam</div>'
              + '<div class="text-2xl font-bold text-green-800 dark:text-green-200">₺' + grandTotal.toLocaleString('tr-TR') + '</div>'
              + '</div>';
        if (suggested > 0) {
          html += '<div class="p-4 rounded-lg border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">'
               + '<div class="text-sm font-medium text-purple-700 dark:text-purple-300">Önerilen Bütçe</div>'
               + '<div class="text-2xl font-bold text-purple-800 dark:text-purple-200">₺' + suggested.toLocaleString('tr-TR') + '</div>'
               + '</div>';
        }
        html += '</div>';

        // Category breakdown
        for (const [cat, details] of entries) {
          const items = (details?.items ?? []) as Array<{ description?: string; amount?: number; isPaid?: boolean }>;
          const total = Number(details?.total ?? 0) || items.reduce((s, it) => s + Number(it.amount ?? 0), 0);
          html += '<div class="rounded-lg border border-gray-200 dark:border-gray-700 mb-3">';
          html += '<div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/40">'
               +  '<div class="font-semibold text-gray-800 dark:text-white capitalize">' + cat + '</div>'
               +  '<div class="text-sm font-bold text-gray-900 dark:text-gray-100">₺' + total.toLocaleString('tr-TR') + '</div>'
               +  '</div>';
          if (items.length > 0) {
            html += '<div class="divide-y divide-gray-200 dark:divide-gray-700">';
            for (const it of items) {
              const amt = Number(it?.amount ?? 0);
              html += '<div class="flex items-start justify-between p-3">'
                   +   '<div class="text-sm text-gray-700 dark:text-gray-300">' + (it?.description || 'Kalem') + '</div>'
                   +   '<div class="text-sm font-medium text-gray-900 dark:text-gray-100">₺' + amt.toLocaleString('tr-TR') + '</div>'
                   + '</div>';
            }
            html += '</div>';
          }
          html += '</div>';
        }

        return sanitizeHtml(html);
      }
    } catch {}

    // Fallback to original formatter (markdown/html)
    return formatContent(raw);
  };

  const parseDailyPlan = (content: string | null) => {
    if (!content) return [];
    
    console.log("🔍 Ham günlük plan verisi:", content.substring(0, 300) + "...");
    
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
        console.log("✂️ '### Günlük Detaylı Program' başlığından sonrası alındı");
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
          console.log("✂️ '## Günlük Program' başlığından sonrası alındı");
        }
      }
    }

    console.log("🎯 İşlenecek içerik:", actualContent.substring(0, 300) + "...");
    
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
              dayContent += '<h4 class="text-md font-semibold text-purple-600 dark:text-purple-400 mb-3">📋 Aktiviteler</h4>';
              dayContent += '<ul class="space-y-2 mb-4">';
              day.activities.forEach((activity: DayActivity) => {
                if (activity && typeof activity === 'object') {
                  dayContent += '<li class="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">';
                  dayContent += '<span class="text-blue-500 mt-1">📍</span>';
                  dayContent += '<div class="flex-1">';
                  if (activity.name) {
                    dayContent += `<h5 class="font-semibold text-gray-800 dark:text-white">${activity.name}</h5>`;
                  }
                  if (activity.startTime || activity.endTime) {
                    dayContent += '<div class="text-sm text-gray-600 dark:text-gray-300 mt-1">';
                    if (activity.startTime) {
                      dayContent += `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 mr-2">🕐 ${activity.startTime}</span>`;
                    }
                    if (activity.endTime) {
                      dayContent += `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">${activity.endTime}</span>`;
                    }
                    dayContent += '</div>';
                  }
                  if (activity.description) {
                    dayContent += `<p class="text-gray-600 dark:text-gray-300 mt-2">${activity.description}</p>`;
                  }
                  if (activity.cost && activity.cost > 0) {
                    dayContent += `<div class="mt-2"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">💰 ${activity.cost}₺</span></div>`;
                  }
                  dayContent += '</div></li>';
                }
              });
              dayContent += '</ul>';
            } else {
              dayContent += '<div class="text-center py-8 text-gray-500 dark:text-gray-400">';
              dayContent += '<div class="text-4xl mb-3">📝</div>';
              dayContent += '<p>Bu gün için henüz aktivite planlanmamış</p>';
              dayContent += '</div>';
            }
            
            // Notları formatla
            if (day.notes && day.notes.trim()) {
              dayContent += '<h4 class="text-md font-semibold text-green-600 dark:text-green-400 mb-2 mt-4">📝 Notlar</h4>';
              dayContent += `<div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border-l-4 border-yellow-400"><p class="text-gray-700 dark:text-gray-300">${day.notes}</p></div>`;
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
        console.log(`✅ Pattern ${i + 1} başarılı - ${matches.length} gün bulundu`);
        
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
          console.log(`📅 Gün ${dayNumber}: ${dayContent.substring(0, 100)}...`);
          
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
      console.log("⚠️ Standart patternler çalışmadı, alternatif yöntemler deneniyor...");
      
      // --- ayırıcılarını kullanarak böl
      if (normalizedContent.includes('---')) {
        const sections = normalizedContent.split(/\n?\s*---\s*\n?/).filter(section => section.trim());
        
        if (sections.length > 1) {
          console.log(`📋 --- ayırıcısı ile ${sections.length} bölüm bulundu`);
          
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
          console.log(`📝 ${paragraphs.length} büyük paragraf gün olarak kabul edildi`);
          
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
    
    console.log(`📊 Toplam ${sortedDays.length} gün ayrıştırıldı`);
    
    return sortedDays;
  };

  const formatDayContent = (content: string) => {
    return sanitizeHtml(content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-600 dark:text-blue-400">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-green-600 dark:text-green-400">$1</em>')
      .replace(/###\s(.*?)\n/g, '<h4 class="text-md font-semibold text-purple-600 dark:text-purple-400 mt-3 mb-2">$1</h4>')
      .replace(/##\s(.*?)\n/g, '<h3 class="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-4 mb-2">$1</h3>')
      .replace(/^\-\s(.*?)$/gm, '<li class="flex items-start space-x-2 mb-1"><span class="text-blue-500 mt-1">•</span><span>$1</span></li>')
      .replace(/(\d{1,2}:\d{2})/g, '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 mr-2">$1</span>')
      .replace(/₺[\d,]+/g, '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">$&</span>')
      .replace(/\n/g, '<br />'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300">Plan detayları yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Bir Hata Oluştu</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <div className="space-x-4">
            <button
              onClick={() => router.back()}
              className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
            >
              Geri Dön
            </button>
            <Link
              href="/my-plans"
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 inline-block"
            >
              Planlarım
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Genel Bakış', icon: '📋' },
    { id: 'city-info', label: 'Şehir Bilgisi', icon: '🏙️' },
    { id: 'daily-plan', label: 'Günlük Plan', icon: '📅' },
    { id: 'food-guide', label: 'Yemek Rehberi', icon: '🍽️' },
    { id: 'practical-info', label: 'Pratik Bilgiler', icon: '💡' },
    { id: 'budget', label: 'Maliyet', icon: '💰' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              ← Geri Dön
            </button>
            <div className="flex space-x-2">
              <button
                onClick={deletePlan}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 text-sm"
              >
                Planı Sil
              </button>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                  {plan.city}
                  {plan.country && (
                    <span className="text-xl text-gray-500 dark:text-gray-400 ml-2">
                      {plan.country}
                    </span>
                  )}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  {plan.startDate && plan.endDate && (
                    <>
                      {new Date(plan.startDate).toLocaleDateString('tr-TR')} - 
                      {new Date(plan.endDate).toLocaleDateString('tr-TR')}
                    </>
                  )}
                  {plan.duration && <span className="ml-2">({plan.duration})</span>}
                </p>
              </div>
              
              <div className="text-right">
                <div className="flex flex-col items-end space-y-2 mb-2">
                  {/* Status Display */}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(getTripStatus(
                    plan.startDate ? new Date(plan.startDate) : null,
                    plan.endDate ? new Date(plan.endDate) : null,
                    plan.status
                  ))}`}>
                    {getStatusLabel(getTripStatus(
                      plan.startDate ? new Date(plan.startDate) : null,
                      plan.endDate ? new Date(plan.endDate) : null,
                      plan.status
                    ))}
                  </span>
                  
                  {/* Plan Type */}
                  {plan.ai_model === 'manual_planning' ? (
                    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm">
                      Manuel Plan
                    </span>
                  ) : (
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm">
                      AI Plan
                    </span>
                  )}
                </div>

                {/* Status Action Buttons */}
                {(() => {
                  const currentStatus = getTripStatus(
                    plan.startDate ? new Date(plan.startDate) : null,
                    plan.endDate ? new Date(plan.endDate) : null,
                    plan.status
                  );
                  
                  return (
                    <div className="flex flex-col space-y-2 mb-4">
                      {canCancel(currentStatus) && (
                        <button
                          onClick={() => updatePlanStatus(TripStatus.CANCELLED)}
                          className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 transition-colors duration-200 text-sm font-medium"
                        >
                          İptal Et
                        </button>
                      )}
                      {canMarkAsDone(currentStatus) && (
                        <button
                          onClick={() => updatePlanStatus(TripStatus.DONE)}
                          className="bg-purple-500 text-white px-3 py-1 rounded-lg hover:bg-purple-600 transition-colors duration-200 text-sm font-medium"
                        >
                          Tamamlandı
                        </button>
                      )}
                    </div>
                  );
                })()}

                {plan.total_cost && (
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ₺{plan.total_cost.toLocaleString('tr-TR')}
                  </div>
                )}
                {plan.daily_cost && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Günlük: ₺{plan.daily_cost.toLocaleString('tr-TR')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Plan Özeti</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300">Seyahat Bilgileri</h3>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Şehir:</span>
                        <span className="font-medium">{plan.city}</span>
                      </div>
                      {plan.country && (
                        <div className="flex justify-between">
                          <span>Ülke:</span>
                          <span className="font-medium">{plan.country}</span>
                        </div>
                      )}
                      {plan.duration && (
                        <div className="flex justify-between">
                          <span>Süre:</span>
                          <span className="font-medium">{plan.duration}</span>
                        </div>
                      )}
                      {plan.travel_style && (
                        <div className="flex justify-between">
                          <span>Seyahat Tarzı:</span>
                          <span className="font-medium capitalize">{plan.travel_style}</span>
                        </div>
                      )}
                      {plan.budget_level && (
                        <div className="flex justify-between">
                          <span>Bütçe Seviyesi:</span>
                          <span className="font-medium capitalize">{plan.budget_level}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300">Maliyet Bilgileri</h3>
                    <div className="mt-2 space-y-2 text-sm">
                      {plan.total_cost && (
                        <div className="flex justify-between">
                          <span>Toplam Maliyet:</span>
                          <span className="font-bold text-green-600">₺{plan.total_cost.toLocaleString('tr-TR')}</span>
                        </div>
                      )}
                      {plan.daily_cost && (
                        <div className="flex justify-between">
                          <span>Günlük Maliyet:</span>
                          <span className="font-medium">₺{plan.daily_cost.toLocaleString('tr-TR')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300">Plan Bilgileri</h3>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Oluşturma Tarihi:</span>
                        <span className="font-medium">{new Date(plan.createdAt).toLocaleDateString('tr-TR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Plan Türü:</span>
                        <span className="font-medium">{plan.ai_model === 'manual_planning' ? 'Manuel' : 'AI'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {plan.interests && (
                <div>
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">İlgi Alanları</h3>
                  <div className="flex flex-wrap gap-2">
                    {JSON.parse(plan.interests).map((interest: string, index: number) => (
                      <span key={index} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'city-info' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Şehir Bilgisi</h2>
              {plan.sehir_bilgisi ? (
                <div 
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatContent(plan.sehir_bilgisi) || '' }}
                />
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Bu plan için şehir bilgisi mevcut değil.</p>
              )}
            </div>
          )}

          {activeTab === 'daily-plan' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Günlük Plan</h2>
              {plan.gun_plani ? (
                (() => {
                  const dailyPlans = parseDailyPlan(plan.gun_plani);
                  
                  if (dailyPlans.length === 0) {
                    return (
                      <div 
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatContent(plan.gun_plani) || '' }}
                      />
                    );
                  }
                  
                  return (
                    <div className="space-y-6">
                      {dailyPlans.map((dayPlan, index) => (
                        <div key={index} className={`rounded-xl p-6 border shadow-sm transition-all hover:shadow-md ${
                          dayPlan.isEmpty 
                            ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600' 
                            : 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 border-blue-100 dark:border-gray-600'
                        }`}>
                          <div className="flex items-center mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mr-4 ${
                              dayPlan.isEmpty 
                                ? 'bg-gray-400 text-white' 
                                : 'bg-blue-500 text-white'
                            }`}>
                              {dayPlan.day}
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                              {dayPlan.day}. Gün
                            </h3>
                            {plan.startDate && (
                              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                                {new Date(new Date(plan.startDate).getTime() + (dayPlan.day - 1) * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR', { 
                                  weekday: 'long', 
                                  day: 'numeric', 
                                  month: 'long' 
                                })}
                              </span>
                            )}
                            {dayPlan.isEmpty && (
                              <span className="ml-2 px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                                Boş
                              </span>
                            )}
                          </div>
                          
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                            <div 
                              className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
                              dangerouslySetInnerHTML={{ __html: dayPlan.isEmpty ? 
                                '<div class="text-center py-8 text-gray-500 dark:text-gray-400"><div class="text-4xl mb-3">📝</div><p>Bu gün için henüz plan yapılmamış</p></div>' :
                                formatDayContent(dayPlan.content) 
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      
                      {dailyPlans.length > 0 && (
                        <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-green-800 dark:text-green-300 font-medium">
                                Toplam {dailyPlans.length} günlük plan
                              </span>
                            </div>
                            <div className="text-sm text-green-700 dark:text-green-400">
                              {dailyPlans.filter(day => !day.isEmpty).length} dolu, {dailyPlans.filter(day => day.isEmpty).length} boş gün
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📅</div>
                  <p className="text-gray-500 dark:text-gray-400 text-lg">Bu plan için günlük plan mevcut değil.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'food-guide' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Yemek Rehberi</h2>
              {plan.yemek_rehberi ? (
                <div 
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatContent(plan.yemek_rehberi) || '' }}
                />
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Bu plan için yemek rehberi mevcut değil.</p>
              )}
            </div>
          )}

          {activeTab === 'practical-info' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Pratik Bilgiler</h2>
              {plan.pratik_bilgiler ? (
                <div 
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatContent(plan.pratik_bilgiler) || '' }}
                />
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Bu plan için pratik bilgiler mevcut değil.</p>
              )}
            </div>
          )}

          {activeTab === 'budget' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Plan Maliyeti</h2>
              
              {/* Maliyet Özeti */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">Toplam Maliyet</p>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                        ₺{plan.total_cost ? plan.total_cost.toLocaleString('tr-TR') : '0'}
                      </p>
                    </div>
                    <div className="text-green-500 text-3xl">💰</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Günlük Ortalama</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                        ₺{plan.daily_cost ? plan.daily_cost.toLocaleString('tr-TR') : '0'}
                      </p>
                    </div>
                    <div className="text-blue-500 text-3xl">📅</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Önerilen Bütçe</p>
                      <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                        ₺{plan.total_cost ? Math.round(plan.total_cost * 1.2).toLocaleString('tr-TR') : '0'}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">%20 rezerv ile</p>
                    </div>
                    <div className="text-purple-500 text-3xl">🎯</div>
                  </div>
                </div>
              </div>

              {/* Detaylı Maliyet */}
              {plan.butce_tahmini ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Detaylı Maliyet Dağılımı</h3>
                  <div 
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderBudgetHtml(plan.butce_tahmini) || '' }}
                  />
                  
                  <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-start space-x-3">
                      <div className="text-yellow-500 text-xl">💡</div>
                      <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                          Maliyet Düzenleme
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                          Bu planın maliyetlerini düzenlemek için <strong>Maliyet Planlayıcı</strong>&apos;ya gidin.
                          Orada her kalemi tek tek düzenleyebilir ve planın toplam maliyetini güncelleyebilirsiniz.
                        </p>
                        <a 
                          href="/budget" 
                          className="inline-flex items-center mt-2 text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                        >
                          Maliyet Planlayıcıya Git →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">💰</div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Maliyet Detayı Yok</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Bu plan için detaylı maliyet bilgisi mevcut değil.
                  </p>
                  <a 
                    href="/budget" 
                    className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Maliyet Planlayıcıya Git
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
