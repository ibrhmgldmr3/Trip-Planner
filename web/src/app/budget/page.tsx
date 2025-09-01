"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

interface BudgetItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date?: string;
  isEstimate: boolean;
  isPaid: boolean;
  paymentMethod?: string;
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
  status?: string;
}

export default function BudgetPage() {
  const { status } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [originalBudgetItems, setOriginalBudgetItems] = useState<BudgetItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state for new budget item
  const [newItem, setNewItem] = useState({
    category: 'ulaşım',
    description: '',
    amount: 0,
    currency: 'TRY',
    isEstimate: true,
    isPaid: false,
    paymentMethod: ''
  });

  // Plan düzenlenebilirlik kontrolü
  const isPlanEditable = (trip: Trip | null) => {
    if (!trip) return false;
    return trip.status === 'PLANLANDI' || !trip.status; // status yoksa da düzenlenebilir kabul et
  };

  // Değişiklikleri kaydetme fonksiyonu
  const saveChanges = async () => {
    if (!selectedTrip || !isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenebilir değil');
      return;
    }

    try {
      // API'ye güncellemeleri gönder
      await updateTripCosts(selectedTrip.id, budgetItems);
      setOriginalBudgetItems([...budgetItems]);
      setHasChanges(false);
      toast.success('Değişiklikler kaydedildi');
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Değişiklikler kaydedilemedi');
    }
  };

  // API güncelleme fonksiyonu
  const updateTripCosts = async (tripId: string, items: BudgetItem[]) => {
    // Sadece ekstra kalemlerin toplam maliyetini hesapla
    const extraItemsTotal = items.reduce((sum, item) => sum + item.amount, 0);
    
    // Önerilen bütçe hesaplama (%25 rezerv)
    const newSuggestedBudget = Math.round(extraItemsTotal * 1.25);
    
    const updatedBudgetData = {
      categories: items.reduce((acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = { items: [], total: 0 };
        }
        acc[item.category].items.push({
          description: item.description,
          amount: item.amount,
          isPaid: item.isPaid
        });
        acc[item.category].total += item.amount;
        return acc;
      }, {} as Record<string, { items: Array<{description: string; amount: number; isPaid: boolean}>; total: number }>),
      extraItemsTotal: extraItemsTotal,
      totalCostWithExtras: extraItemsTotal,
      suggestedBudget: newSuggestedBudget
    };

    // Plan maliyetini API ile güncelle - Sadece bütçe tahmini field'ını güncelle
    const response = await fetch(`/api/plan-detail/${tripId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        butce_tahmini: JSON.stringify(updatedBudgetData)
      })
    });

    if (!response.ok) {
      throw new Error('Plan güncellenemedi');
    }
  };

  // Değişiklikleri iptal etme fonksiyonu
  const cancelChanges = () => {
    setBudgetItems([...originalBudgetItems]);
    setHasChanges(false);
    setShowAddForm(false);
    toast.success('Değişiklikler iptal edildi');
  };

  // Markdown formatındaki bütçe verisini parse eden fonksiyon
  const parseMarkdownBudget = (markdownText: string) => {
    const items: Array<{ description: string; amount: number; category: string }> = [];
    
    // Basit regex ile fiyat bilgilerini çıkar
    const priceRegex = /(\d+(?:\.\d+)?)\s*(?:TL|₺|TRY)/gi;
    const lines = markdownText.split('\n');
    
    let currentCategory = 'genel';
    
    for (const line of lines) {
      // Kategori başlıkları için
      if (line.includes('**') && (line.includes('Ulaşım') || line.includes('Konaklama') || line.includes('Yemek') || line.includes('Aktivite'))) {
        if (line.includes('Ulaşım')) currentCategory = 'ulaşım';
        else if (line.includes('Konaklama')) currentCategory = 'konaklama';
        else if (line.includes('Yemek')) currentCategory = 'yemek';
        else if (line.includes('Aktivite')) currentCategory = 'aktiviteler';
        continue;
      }
      
      // Fiyat içeren satırları bul
      const priceMatch = line.match(priceRegex);
      if (priceMatch) {
        const amount = parseFloat(priceMatch[0].replace(/[^0-9.]/g, ''));
        const description = line.replace(priceRegex, '').replace(/[*-]/g, '').trim();
        
        if (description && amount > 0) {
          items.push({
            description: description || 'Açıklama yok',
            amount: amount,
            category: currentCategory
          });
        }
      }
    }
    
    return { items };
  };

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      toast.error('Bu sayfayı görüntülemek için giriş yapmanız gerekiyor');
      router.push('/login');
      return;
    }
    
    if (status === 'authenticated') {
      // Bütçe kalemlerini getir
      const fetchBudgetItems = async (tripId: string) => {
        if (!tripId) return;
        
        try {
          const response = await fetch(`/api/plan-detail/${tripId}`);
          
          if (!response.ok) {
            throw new Error('Plan detayı yüklenemedi');
          }
          
          const data = await response.json();
          
          if (data.success && data.plan) {
            // Eğer plan bütçe tahmini varsa, onu parse et
            if (data.plan.butce_tahmini) {
              try {
                // Önce JSON olarak parse etmeyi dene
                let budgetData;
                try {
                  budgetData = JSON.parse(data.plan.butce_tahmini);
                } catch {
                  // JSON değilse, markdown formatından parse et
                  budgetData = parseMarkdownBudget(data.plan.butce_tahmini);
                }
                
                // Budget verilerini BudgetItem formatına çevir
                const items: BudgetItem[] = [];
                
                // Bütçe verilerini kategori bazında işle
                if (budgetData && budgetData.categories) {
                  Object.entries(budgetData.categories).forEach(([category, details]: [string, unknown]) => {
                    const categoryDetails = details as { items?: unknown[]; total?: number };
                    
                    if (categoryDetails.items && Array.isArray(categoryDetails.items)) {
                      categoryDetails.items.forEach((item: unknown, index: number) => {
                        const budgetItem = item as { description?: string; name?: string; amount?: number; price?: number };
                        items.push({
                          id: `${category}-${index}`,
                          category: category,
                          description: budgetItem.description || budgetItem.name || 'Açıklama yok',
                          amount: budgetItem.amount || budgetItem.price || 0,
                          currency: 'TRY',
                          isEstimate: true,
                          isPaid: false
                        });
                      });
                    } else if (categoryDetails.total) {
                      // Eğer sadece toplam varsa, genel bir kalem oluştur
                      items.push({
                        id: `${category}-total`,
                        category: category,
                        description: `${category} toplam`,
                        amount: categoryDetails.total,
                        currency: 'TRY',
                        isEstimate: true,
                        isPaid: false
                      });
                    }
                  });
                } else if (budgetData && budgetData.items) {
                  // Direkt items array'i varsa
                  budgetData.items.forEach((item: unknown, index: number) => {
                    const budgetItem = item as { description?: string; name?: string; amount?: number; price?: number; category?: string };
                    items.push({
                      id: `item-${index}`,
                      category: budgetItem.category || 'genel',
                      description: budgetItem.description || budgetItem.name || 'Açıklama yok',
                      amount: budgetItem.amount || budgetItem.price || 0,
                      currency: 'TRY',
                      isEstimate: true,
                      isPaid: false
                    });
                  });
                }
                
                setBudgetItems(items);
                setOriginalBudgetItems([...items]);
                setHasChanges(false);
              } catch (parseError) {
                console.error('Bütçe verisi parse edilemedi:', parseError);
                setBudgetItems([]);
                setOriginalBudgetItems([]);
                setHasChanges(false);
              }
            } else {
              setBudgetItems([]);
              setOriginalBudgetItems([]);
              setHasChanges(false);
            }
          }
        } catch (err) {
          console.error('Budget fetch error:', err);
          setBudgetItems([]);
          setOriginalBudgetItems([]);
          setHasChanges(false);
        }
      };
      
      const fetchUserTrips = async () => {
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
              fetchBudgetItems(data.plans[0].id);
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
      };
      
      fetchUserTrips();
    }
  }, [status, router]);

  // selectedTrip değiştiğinde budget yükle
  useEffect(() => {
    if (!selectedTrip?.id) return;
    
    const fetchBudgetItems = async () => {
      try {
        const response = await fetch(`/api/plan-detail/${selectedTrip.id}`);
        
        if (!response.ok) {
          throw new Error('Plan detayı yüklenemedi');
        }
        
        const data = await response.json();
        
        if (data.success && data.plan) {
          // Eğer plan bütçe tahmini varsa, onu parse et
          if (data.plan.butce_tahmini) {
            try {
              // Önce JSON olarak parse etmeyi dene
              let budgetData;
              try {
                budgetData = JSON.parse(data.plan.butce_tahmini);
              } catch {
                // JSON değilse, markdown formatından parse et
                budgetData = parseMarkdownBudget(data.plan.butce_tahmini);
              }
              
              // Budget verilerini BudgetItem formatına çevir
              const items: BudgetItem[] = [];
              
              // Bütçe verilerini kategori bazında işle
              if (budgetData && budgetData.categories) {
                Object.entries(budgetData.categories).forEach(([category, details]: [string, unknown]) => {
                  const categoryDetails = details as { items?: unknown[]; total?: number };
                  
                  if (categoryDetails.items && Array.isArray(categoryDetails.items)) {
                    categoryDetails.items.forEach((item: unknown, index: number) => {
                      const budgetItem = item as { description?: string; name?: string; amount?: number; price?: number };
                      items.push({
                        id: `${category}-${index}`,
                        category: category,
                        description: budgetItem.description || budgetItem.name || 'Açıklama yok',
                        amount: budgetItem.amount || budgetItem.price || 0,
                        currency: 'TRY',
                        isEstimate: true,
                        isPaid: false
                      });
                    });
                  } else if (categoryDetails.total) {
                    // Eğer sadece toplam varsa, genel bir kalem oluştur
                    items.push({
                      id: `${category}-total`,
                      category: category,
                      description: `${category} toplam`,
                      amount: categoryDetails.total,
                      currency: 'TRY',
                      isEstimate: true,
                      isPaid: false
                    });
                  }
                });
              } else if (budgetData && budgetData.items) {
                // Direkt items array'i varsa
                budgetData.items.forEach((item: unknown, index: number) => {
                  const budgetItem = item as { description?: string; name?: string; amount?: number; price?: number; category?: string };
                  items.push({
                    id: `item-${index}`,
                    category: budgetItem.category || 'genel',
                    description: budgetItem.description || budgetItem.name || 'Açıklama yok',
                    amount: budgetItem.amount || budgetItem.price || 0,
                    currency: 'TRY',
                    isEstimate: true,
                    isPaid: false
                  });
                });
              }
              
              setBudgetItems(items);
              setOriginalBudgetItems([...items]);
              setHasChanges(false);
            } catch (parseError) {
              console.error('Bütçe verisi parse edilemedi:', parseError);
              setBudgetItems([]);
              setOriginalBudgetItems([]);
              setHasChanges(false);
            }
          } else {
            setBudgetItems([]);
            setOriginalBudgetItems([]);
            setHasChanges(false);
          }
        }
      } catch (err) {
        console.error('Budget fetch error:', err);
        setBudgetItems([]);
        setOriginalBudgetItems([]);
        setHasChanges(false);
      }
    };
    
    fetchBudgetItems();
  }, [selectedTrip?.id]);

  const addBudgetItem = () => {
    if (!selectedTrip || !isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenebilir değil');
      return;
    }

    if (!newItem.description || newItem.amount <= 0) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }
    
    const newBudgetItem: BudgetItem = {
      id: Date.now().toString(),
      ...newItem
    };
    
    setBudgetItems([...budgetItems, newBudgetItem]);
    setHasChanges(true);
    setNewItem({
      category: 'ulaşım',
      description: '',
      amount: 0,
      currency: 'TRY',
      isEstimate: true,
      isPaid: false,
      paymentMethod: ''
    });
    setShowAddForm(false);
    toast.success('Maliyet kalemi eklendi');
  };

  const deleteBudgetItem = (itemId: string) => {
    if (!selectedTrip || !isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenebilir değil');
      return;
    }

    if (!confirm('Bu maliyet kalemini silmek istediğinizden emin misiniz?')) return;

    setBudgetItems(budgetItems.filter(item => item.id !== itemId));
    setHasChanges(true);
    toast.success('Maliyet kalemi silindi');
  };

  const togglePaidStatus = (itemId: string) => {
    if (!selectedTrip || !isPlanEditable(selectedTrip)) {
      toast.error('Bu plan düzenlenebilir değil');
      return;
    }

    setBudgetItems(budgetItems.map(item => 
      item.id === itemId ? { ...item, isPaid: !item.isPaid } : item
    ));
    setHasChanges(true);
    toast.success('Ödeme durumu güncellendi');
  };

  // Hesaplamalar - Plan maliyeti + Ekstra kalemler mantığı
  const planBaseCost = selectedTrip?.total_cost || 0; // Planın temel maliyeti
  const extraItems = budgetItems.reduce((sum, item) => sum + item.amount, 0); // Eklenen ekstra kalemler
  const totalCost = planBaseCost + extraItems; // Toplam maliyet = Plan maliyeti + Ekstra kalemler
  const suggestedBudget = Math.round(totalCost * 1.25); // %25 rezerv ile önerilen bütçe

  // Günlük hesaplamalar
  const getDays = () => {
    if (!selectedTrip) return 1;
    
    // Önce duration field'ini kontrol et
    if (selectedTrip.duration && selectedTrip.duration > 0) {
      return selectedTrip.duration;
    }
    
    // Duration yoksa tarihlerden hesapla
    const start = new Date(selectedTrip.startDate);
    const end = new Date(selectedTrip.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  const days = getDays();
  const dailyCost = Math.round(totalCost / days);
  const dailySuggestedBudget = Math.round(suggestedBudget / days);

  // Kategori dağılımı
  const categoryTotals = budgetItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const categoryColors: Record<string, string> = {
    'ulaşım': 'bg-blue-500',
    'konaklama': 'bg-purple-500',
    'yemek': 'bg-orange-500',
    'aktiviteler': 'bg-green-500',
    'alışveriş': 'bg-pink-500',
    'eğlence': 'bg-teal-500',
    'diğer': 'bg-gray-500'
  };

  const categoryLabels: Record<string, string> = {
    'ulaşım': '🚗 Ulaşım',
    'konaklama': '🏨 Konaklama',
    'yemek': '🍽️ Yemek',
    'aktiviteler': '🎯 Aktiviteler',
    'alışveriş': '🛍️ Alışveriş',
    'eğlence': '🎉 Eğlence',
    'diğer': '📝 Diğer'
  };

  // Loading durumu
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Bütçe verileri yükleniyor...
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
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
            💰 Bütçe Planlayıcı
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Seyahat bütçenizi planlayın ve harcamalarınızı takip edin
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

        {/* Trip Selection */}
        {trips.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Gezi Seçin</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => {
                    if (hasChanges) {
                      if (confirm('Kaydedilmemiş değişiklikleriniz var. Devam etmek istediğinizden emin misiniz?')) {
                        setSelectedTrip(trip);
                        setHasChanges(false);
                      }
                    } else {
                      setSelectedTrip(trip);
                    }
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
                      Bütçe: ₺{trip.total_cost.toLocaleString('tr-TR')}
                    </p>
                  )}
                  {trip.budget_level && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {trip.budget_level.charAt(0).toUpperCase() + trip.budget_level.slice(1)} • {trip.travel_style}
                    </p>
                  )}
                  {trip.status && (
                    <div className="flex items-center space-x-1 mt-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        trip.status === 'PLANLANDI' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        trip.status === 'AKTIF' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        trip.status === 'TAMAMLANDI' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {trip.status}
                      </span>
                      {!isPlanEditable(trip) && (
                        <span className="text-xs text-orange-600 dark:text-orange-400">• Düzenlenemez</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedTrip && (
          <>
            {/* Cost Overview */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Toplam Maliyet</h3>
                <div className="text-3xl font-bold text-blue-500">₺{totalCost.toLocaleString('tr-TR')}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Günlük: ₺{dailyCost.toLocaleString('tr-TR')}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Plan: ₺{planBaseCost.toLocaleString('tr-TR')} + Ekstra: ₺{extraItems.toLocaleString('tr-TR')}
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Önerilen Bütçe</h3>
                <div className="text-3xl font-bold text-green-500">₺{suggestedBudget.toLocaleString('tr-TR')}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Günlük: ₺{dailySuggestedBudget.toLocaleString('tr-TR')}</div>
                <div className="text-xs text-gray-400 mt-1">+25% rezerv dahil</div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Toplam Kalem</h3>
                <div className="text-3xl font-bold text-purple-500">{budgetItems.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ekstra maliyet kalemi</div>
              </div>
            </div>

            {/* Category Distribution */}
            {/* Plan Base Cost */}
            {planBaseCost > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <h4 className="font-semibold text-blue-800 dark:text-blue-200">Plan Temel Maliyeti</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400">AI tarafından oluşturulan plan maliyeti</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    ₺{planBaseCost.toLocaleString('tr-TR')}
                  </span>
                </div>
              </div>
            )}

            {/* Kategori Dağılımı */}
            {Object.keys(categoryTotals).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Ekstra Kalemler - Kategori Dağılımı</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(categoryTotals).map(([category, amount]) => {
                    const percentage = extraItems > 0 ? (amount / extraItems * 100).toFixed(1) : 0;
                    return (
                      <div key={category} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className={`w-4 h-4 rounded-full ${categoryColors[category]}`}></div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 dark:text-white">{categoryLabels[category] || category}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">₺{amount.toLocaleString('tr-TR')} ({percentage}%)</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Extra Items */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Ekstra Maliyet Kalemleri</h3>
                <div className="flex space-x-2">
                  {hasChanges && isPlanEditable(selectedTrip) && (
                    <>
                      <button
                        onClick={saveChanges}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        💾 Kaydet
                      </button>
                      <button
                        onClick={cancelChanges}
                        className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        ❌ İptal
                      </button>
                    </>
                  )}
                  {isPlanEditable(selectedTrip) && (
                    <button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                    >
                      {showAddForm ? 'İptal' : '+ Ekstra Kalem Ekle'}
                    </button>
                  )}
                </div>
              </div>

              {/* Add Form */}
              {showAddForm && isPlanEditable(selectedTrip) && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
                      <select
                        value={newItem.category}
                        onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="ulaşım">🚗 Ulaşım</option>
                        <option value="konaklama">🏨 Konaklama</option>
                        <option value="yemek">🍽️ Yemek</option>
                        <option value="aktiviteler">🎯 Aktiviteler</option>
                        <option value="alışveriş">🛍️ Alışveriş</option>
                        <option value="eğlence">🎉 Eğlence</option>
                        <option value="diğer">📝 Diğer</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Açıklama</label>
                      <input
                        type="text"
                        value={newItem.description}
                        onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                        placeholder="Açıklama girin..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tutar (₺)</label>
                      <input
                        type="number"
                        value={newItem.amount}
                        onChange={(e) => setNewItem({...newItem, amount: Number(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                        placeholder="0"
                      />
                    </div>
                    
                    <div className="flex items-end">
                      <button
                        onClick={addBudgetItem}
                        className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Budget Items List */}
              {budgetItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">💳</div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Henüz Ekstra Maliyet Kalemi Yok</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Plan maliyetine ek olarak özel harcamalarınızı ekleyebilirsiniz.
                  </p>
                  {!isPlanEditable(selectedTrip) && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mt-4">
                      <p className="text-orange-800 dark:text-orange-200 text-sm">
                        ⚠️ Bu plan düzenlenebilir değil. Sadece &quot;PLANLANDI&quot; statusündeki planlar düzenlenebilir.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {budgetItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`w-4 h-4 rounded-full ${categoryColors[item.category]}`}></div>
                        <div>
                          <h4 className="font-medium text-gray-800 dark:text-white">{item.description}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{categoryLabels[item.category]}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-bold text-gray-800 dark:text-white">₺{item.amount.toLocaleString('tr-TR')}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {item.isEstimate ? 'Tahmini' : 'Kesin'}
                          </div>
                        </div>
                        
                        {isPlanEditable(selectedTrip) && (
                          <button
                            onClick={() => togglePaidStatus(item.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              item.isPaid 
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            }`}
                          >
                            {item.isPaid ? '✅ Ödendi' : '⏳ Ödenmedi'}
                          </button>
                        )}
                        {!isPlanEditable(selectedTrip) && (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            item.isPaid 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                              : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                          }`}>
                            {item.isPaid ? '✅ Ödendi' : '⏳ Ödenmedi'}
                          </span>
                        )}
                        
                        {isPlanEditable(selectedTrip) && (
                          <button
                            onClick={() => deleteBudgetItem(item.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Budget Tips */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-3">💡 Bütçe İpuçları</h3>
              <ul className="list-disc list-inside space-y-2 text-blue-700 dark:text-blue-300">
                <li>Yerel marketlerden alışveriş yaparak yemek maliyetlerinizi düşürebilirsiniz</li>
                <li>Şehir kartları ile ulaşım ve müze girişlerinde tasarruf sağlayabilirsiniz</li>
                <li>Önceden rezervasyon yaparak konaklama maliyetlerini optimize edebilirsiniz</li>
                <li>Yerel festivaller ve ücretsiz etkinlikleri takip ederek eğlence bütçenizi dengeleyebilirsiniz</li>
              </ul>
            </div>
          </>
        )}

        {trips.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">💼</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Henüz Gezi Yok</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Bütçe planlamak için önce bir gezi planı oluşturun.
            </p>
            <button
              onClick={() => router.push('/travel-mode')}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600"
            >
              İlk Gezinizi Planlayın
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
