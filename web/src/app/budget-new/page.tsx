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
  title: string;
  startDate: string;
  endDate: string;
  budget?: number;
}

export default function BudgetPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
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

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      toast.error('Bu sayfayı görüntülemek için giriş yapmanız gerekiyor');
      router.push('/login');
      return;
    }
    
    if (status === 'authenticated') {
      fetchUserTrips();
    }
  }, [status, router]);

  const fetchUserTrips = async () => {
    try {
      // Trip verilerini Al (şimdilik mock data)
      const mockTrips: Trip[] = [
        {
          id: '1',
          title: 'İstanbul Gezisi',
          startDate: '2025-09-01',
          endDate: '2025-09-05',
          budget: 5000
        },
        {
          id: '2',
          title: 'Ankara Gezisi',
          startDate: '2025-10-01',
          endDate: '2025-10-03',
          budget: 3000
        }
      ];
      
      setTrips(mockTrips);
      if (mockTrips.length > 0) {
        setSelectedTrip(mockTrips[0]);
        fetchBudgetItems(mockTrips[0].id);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Geziler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetItems = async (tripId: string) => {
    try {
      // Mock budget items
      const mockBudgetItems: BudgetItem[] = [
        {
          id: '1',
          category: 'ulaşım',
          description: 'Uçak bileti',
          amount: 800,
          currency: 'TRY',
          isEstimate: false,
          isPaid: true,
          paymentMethod: 'Kredi Kartı'
        },
        {
          id: '2',
          category: 'konaklama',
          description: 'Otel rezervasyonu',
          amount: 1200,
          currency: 'TRY',
          isEstimate: false,
          isPaid: true,
          paymentMethod: 'Kredi Kartı'
        },
        {
          id: '3',
          category: 'yemek',
          description: 'Restoran harcamaları',
          amount: 600,
          currency: 'TRY',
          isEstimate: true,
          isPaid: false
        }
      ];
      
      setBudgetItems(mockBudgetItems);
    } catch (err) {
      console.error('Budget fetch error:', err);
    }
  };

  const addBudgetItem = async () => {
    if (!selectedTrip || !newItem.description || newItem.amount <= 0) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }
    
    const newBudgetItem: BudgetItem = {
      id: Date.now().toString(),
      ...newItem
    };
    
    setBudgetItems([...budgetItems, newBudgetItem]);
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
    toast.success('Bütçe kalemi eklendi');
  };

  const deleteBudgetItem = async (itemId: string) => {
    if (!confirm('Bu bütçe kalemini silmek istediğinizden emin misiniz?')) return;

    setBudgetItems(budgetItems.filter(item => item.id !== itemId));
    toast.success('Bütçe kalemi silindi');
  };

  const togglePaidStatus = (itemId: string) => {
    setBudgetItems(budgetItems.map(item => 
      item.id === itemId ? { ...item, isPaid: !item.isPaid } : item
    ));
    toast.success('Ödeme durumu güncellendi');
  };

  // Hesaplamalar
  const totalExpenses = budgetItems.reduce((sum, item) => sum + item.amount, 0);
  const totalBudget = selectedTrip?.budget || 0;
  const remainingBudget = totalBudget - totalExpenses;
  const budgetRatio = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

  // Günlük hesaplamalar
  const getDays = () => {
    if (!selectedTrip) return 1;
    const start = new Date(selectedTrip.startDate);
    const end = new Date(selectedTrip.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  const days = getDays();
  const dailyBudget = Math.round(totalBudget / days);
  const dailySpent = Math.round(totalExpenses / days);

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
                    setSelectedTrip(trip);
                    fetchBudgetItems(trip.id);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedTrip?.id === trip.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                  }`}
                >
                  <h3 className="font-bold text-gray-800 dark:text-white">{trip.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {new Date(trip.startDate).toLocaleDateString('tr-TR')} - 
                    {new Date(trip.endDate).toLocaleDateString('tr-TR')}
                  </p>
                  {trip.budget && (
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Bütçe: ₺{trip.budget.toLocaleString('tr-TR')}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedTrip && (
          <>
            {/* Budget Overview */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Toplam Bütçe</h3>
                <div className="text-3xl font-bold text-blue-500">₺{totalBudget.toLocaleString('tr-TR')}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Günlük: ₺{dailyBudget.toLocaleString('tr-TR')}</div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Toplam Harcama</h3>
                <div className="text-3xl font-bold text-orange-500">₺{totalExpenses.toLocaleString('tr-TR')}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Günlük: ₺{dailySpent.toLocaleString('tr-TR')}</div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Kalan Bütçe</h3>
                <div className={`text-3xl font-bold ${remainingBudget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ₺{remainingBudget.toLocaleString('tr-TR')}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {remainingBudget >= 0 ? 'Bütçe dahilinde' : 'Bütçe aşımı!'}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Kullanım Oranı</h3>
                <div className="text-3xl font-bold text-purple-500">{budgetRatio.toFixed(1)}%</div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div 
                    className={`h-2 rounded-full ${
                      budgetRatio > 100 ? 'bg-red-500' :
                      budgetRatio > 90 ? 'bg-orange-500' :
                      budgetRatio > 75 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budgetRatio, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Category Distribution */}
            {Object.keys(categoryTotals).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Kategori Dağılımı</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(categoryTotals).map(([category, amount]) => {
                    const percentage = totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(1) : 0;
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

            {/* Budget Items */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Bütçe Kalemleri</h3>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                >
                  {showAddForm ? 'İptal' : '+ Kalem Ekle'}
                </button>
              </div>

              {/* Add Form */}
              {showAddForm && (
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
                  <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Henüz Bütçe Kalemi Yok</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    İlk bütçe kaleminizi ekleyerek başlayın.
                  </p>
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
                        
                        <button
                          onClick={() => deleteBudgetItem(item.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          🗑️
                        </button>
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
