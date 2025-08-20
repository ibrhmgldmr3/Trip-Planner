"use client";

import Link from "next/link";
import { useState } from "react";

export default function BudgetPage() {
  const [totalBudget, setTotalBudget] = useState(10000);
  const [days, setDays] = useState(5);

  // Örnek bütçe öğeleri
  const budgetItems = [
    { id: 1, category: 'Ulaşım', amount: 2500, details: 'Uçak gidiş-dönüş', editable: true },
    { id: 2, category: 'Konaklama', amount: 4000, details: '4 gece otel', editable: true },
    { id: 3, category: 'Yemek', amount: 1500, details: 'Günlük 300 TL x 5 gün', editable: true },
    { id: 4, category: 'Aktiviteler', amount: 1000, details: 'Müze, tur, etkinlikler', editable: true },
    { id: 5, category: 'Alışveriş', amount: 800, details: 'Hediyelik eşya', editable: true },
    { id: 6, category: 'Diğer', amount: 200, details: 'Acil durumlar', editable: true },
  ];

  // Toplam harcamayı hesapla
  const totalExpenses = budgetItems.reduce((sum, item) => sum + item.amount, 0);
  const remainingBudget = totalBudget - totalExpenses;
  const budgetPerDay = Math.round(totalBudget / days);
  const expensesPerDay = Math.round(totalExpenses / days);

  // Bütçe oran ve renk hesaplama
  const budgetRatio = (totalExpenses / totalBudget) * 100;
  const budgetColor = 
    budgetRatio > 100 ? 'bg-red-500' :
    budgetRatio > 90 ? 'bg-orange-500' :
    budgetRatio > 75 ? 'bg-yellow-500' :
    'bg-green-500';

  // Kategori dağılımı için renk tanımlamaları
  const categoryColors = {
    'Ulaşım': 'bg-blue-500',
    'Konaklama': 'bg-purple-500',
    'Yemek': 'bg-orange-500',
    'Aktiviteler': 'bg-green-500',
    'Alışveriş': 'bg-pink-500',
    'Diğer': 'bg-gray-500',
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Bütçe Planlayıcı
            </h1>
            <p className="text-gray-600 mt-2 max-w-2xl">
              Seyahat bütçenizi planlayın, harcamalarınızı takip edin ve seyahat maliyetlerinizi optimize edin.
            </p>
          </div>
          <Link 
            href="/"
            className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors self-start"
          >
            Ana Sayfaya Dön
          </Link>
        </div>

        {/* Budget Settings */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Bütçe Ayarları</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="totalBudget" className="block text-sm font-medium text-gray-700 mb-1">Toplam Bütçe (TL)</label>
              <input 
                type="number" 
                id="totalBudget" 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={totalBudget}
                onChange={(e) => setTotalBudget(Number(e.target.value))}
              />
            </div>
            
            <div>
              <label htmlFor="days" className="block text-sm font-medium text-gray-700 mb-1">Seyahat Süresi (Gün)</label>
              <input 
                type="number" 
                id="days" 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Budget Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Budget Card */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-medium mb-2">Toplam Bütçe</h3>
            <div className="text-3xl font-bold text-blue-600">{totalBudget.toLocaleString()} TL</div>
            <div className="text-sm text-gray-500 mt-1">Günlük: {budgetPerDay.toLocaleString()} TL</div>
          </div>
          
          {/* Expenses Card */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-medium mb-2">Toplam Harcama</h3>
            <div className="text-3xl font-bold text-orange-600">{totalExpenses.toLocaleString()} TL</div>
            <div className="text-sm text-gray-500 mt-1">Günlük: {expensesPerDay.toLocaleString()} TL</div>
          </div>
          
          {/* Remaining Budget Card */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-medium mb-2">Kalan Bütçe</h3>
            <div className={`text-3xl font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {remainingBudget.toLocaleString()} TL
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {remainingBudget >= 0 ? 'Bütçe dahilinde' : 'Bütçe aşımı!'}
            </div>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <h3 className="text-lg font-medium mb-4">Bütçe Kullanımı</h3>
          
          <div className="mb-2 flex justify-between">
            <span className="text-sm font-medium text-gray-600">
              {budgetRatio.toFixed(1)}% Kullanıldı
            </span>
            <span className="text-sm text-gray-500">
              {totalExpenses.toLocaleString()} / {totalBudget.toLocaleString()} TL
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className={`${budgetColor} h-4 rounded-full`} 
              style={{ width: `${Math.min(budgetRatio, 100)}%` }}
            ></div>
          </div>
          
          <div className="mt-6">
            <h4 className="text-md font-medium mb-3">Kategori Dağılımı</h4>
            <div className="space-y-3">
              {budgetItems.map(item => {
                const percentage = (item.amount / totalExpenses * 100).toFixed(1);
                return (
                  <div key={item.id}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{item.category}</span>
                      <span className="text-sm text-gray-500">{percentage}% ({item.amount.toLocaleString()} TL)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`${categoryColors[item.category as keyof typeof categoryColors]} h-2 rounded-full`} 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Budget Details */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Bütçe Detayları</h3>
            <button className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
              Yeni Kalem Ekle
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Açıklama
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tutar (TL)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {budgetItems.map(item => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${categoryColors[item.category as keyof typeof categoryColors]} mr-2`}></div>
                        <div className="text-sm font-medium text-gray-900">{item.category}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.details}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-3">Düzenle</button>
                      <button className="text-red-600 hover:text-red-900">Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    Toplam
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    {totalExpenses.toLocaleString()} TL
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Budget Tips */}
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 mb-8">
          <h3 className="text-lg font-medium text-blue-800 mb-3">Bütçe İpuçları</h3>
          <ul className="list-disc list-inside space-y-2 text-blue-700">
            <li>Yerel halk tarafından tercih edilen restoranlarda yemek yiyerek yemek maliyetlerinizi düşürebilirsiniz.</li>
            <li>Toplu taşıma kullanarak ulaşım maliyetlerinizi optimize edebilirsiniz.</li>
            <li>Şehir kartları veya müze kartları alarak birçok turistik yeri daha uygun fiyata gezebilirsiniz.</li>
            <li>Alışveriş için yerel pazarları tercih edin, hem daha uygun fiyatlı hem de daha otantik ürünler bulabilirsiniz.</li>
            <li>Konaklama için merkeze yakın olmayan bölgeleri tercih etmek bütçenize katkı sağlayabilir.</li>
          </ul>
        </div>
        
        {/* Coming Soon Message */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
          <p className="text-yellow-800">
            <strong>Bilgilendirme:</strong> Bu özellik şu an demo amaçlıdır. Tam işlevsellik yakında eklenecektir.
          </p>
        </div>
        
        <div className="mt-8 text-sm text-gray-500 text-center">
          &copy; {new Date().getFullYear()} Trip Planner - Tüm hakları saklıdır.
        </div>
      </div>
    </main>
  );
}
