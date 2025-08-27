'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

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

  useEffect(() => {
    const fetchPlanDetailEffect = async () => {
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
    };

    if (planId) {
      fetchPlanDetailEffect();
    }
  }, [planId]);

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
    
    // Markdown formatını basic HTML'e çevir
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/###\s(.*?)\n/g, '<h3 class="text-lg font-semibold text-gray-800 dark:text-white mt-4 mb-2">$1</h3>')
      .replace(/##\s(.*?)\n/g, '<h2 class="text-xl font-bold text-gray-800 dark:text-white mt-6 mb-3">$1</h2>')
      .replace(/^\-\s(.*?)$/gm, '<li class="ml-4">• $1</li>')
      .replace(/\n/g, '<br />');
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
    { id: 'budget', label: 'Bütçe', icon: '💰' }
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
                <div className="flex items-center space-x-2 mb-2">
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
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Günlük Plan</h2>
              {plan.gun_plani ? (
                <div 
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatContent(plan.gun_plani) || '' }}
                />
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Bu plan için günlük plan mevcut değil.</p>
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
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Bütçe Tahmini</h2>
              {plan.butce_tahmini ? (
                <div 
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatContent(plan.butce_tahmini) || '' }}
                />
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Bu plan için bütçe tahmini mevcut değil.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
