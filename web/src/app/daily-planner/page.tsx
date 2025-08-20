"use client";

import Link from "next/link";
import { useState } from "react";

// Örnek veri
const sampleItinerary = [
  {
    day: 1,
    date: "15 Aralık 2023, Cuma",
    activities: [
      {
        id: 1,
        time: "09:00 - 11:30",
        type: "morning",
        title: "Ayasofya Müzesi Ziyareti",
        location: "Sultanahmet",
        description: "Dünyanın en önemli tarihi yapılarından biri olan Ayasofya'yı keşfedin.",
        cost: 250,
        category: "kültür",
        image: "/activities/hagia-sophia.jpg"
      },
      {
        id: 2,
        time: "12:00 - 13:30",
        type: "noon",
        title: "Sultanahmet Köftecisi'nde Öğle Yemeği",
        location: "Sultanahmet",
        description: "Meşhur köfte ve piyaz ile enfes bir öğle yemeği.",
        cost: 150,
        category: "yemek",
        image: "/activities/kofte.jpg"
      },
      {
        id: 3,
        time: "14:00 - 16:30",
        type: "afternoon",
        title: "Topkapı Sarayı Turu",
        location: "Sultanahmet",
        description: "Osmanlı İmparatorluğu'nun 400 yıl boyunca yönetildiği sarayı gezin.",
        cost: 350,
        category: "kültür",
        image: "/activities/topkapi.jpg"
      },
      {
        id: 4,
        time: "17:00 - 18:30",
        type: "afternoon",
        title: "Kapalıçarşı Alışverişi",
        location: "Kapalıçarşı",
        description: "Dünyanın en eski ve en büyük kapalı çarşılarından birinde alışveriş yapın.",
        cost: 0,
        category: "alışveriş",
        image: "/activities/grand-bazaar.jpg"
      },
      {
        id: 5,
        time: "19:30 - 21:30",
        type: "evening",
        title: "Akşam Yemeği - Hamdi Restaurant",
        location: "Eminönü",
        description: "Muhteşem manzara eşliğinde geleneksel Türk mutfağından lezzetler.",
        cost: 400,
        category: "yemek",
        image: "/activities/dinner.jpg"
      }
    ]
  },
  {
    day: 2,
    date: "16 Aralık 2023, Cumartesi",
    activities: [
      {
        id: 6,
        time: "09:30 - 11:00",
        type: "morning",
        title: "Galata Kulesi Ziyareti",
        location: "Beyoğlu",
        description: "İstanbul'un en ikonik yapılarından birinden panoramik manzaranın tadını çıkarın.",
        cost: 200,
        category: "kültür",
        image: "/activities/galata.jpg"
      },
      {
        id: 7,
        time: "11:30 - 13:00",
        type: "noon",
        title: "İstiklal Caddesi Yürüyüşü",
        location: "Beyoğlu",
        description: "İstanbul'un en meşhur alışveriş ve eğlence caddesinde keyifli bir yürüyüş.",
        cost: 0,
        category: "gezi",
        image: "/activities/istiklal.jpg"
      },
      {
        id: 8,
        time: "13:00 - 14:30",
        type: "noon",
        title: "Öğle Yemeği - Çiçek Pasajı",
        location: "Beyoğlu",
        description: "Tarihi Çiçek Pasajı'nda yerel lezzetlerden oluşan bir öğle yemeği.",
        cost: 200,
        category: "yemek",
        image: "/activities/cicek-pasaji.jpg"
      },
      {
        id: 9,
        time: "15:00 - 17:30",
        type: "afternoon",
        title: "Boğaz Turu",
        location: "Eminönü",
        description: "İstanbul Boğazı'nın eşsiz güzelliklerini tekne turu ile keşfedin.",
        cost: 300,
        category: "gezi",
        image: "/activities/bosphorus.jpg"
      },
      {
        id: 10,
        time: "18:30 - 21:00",
        type: "evening",
        title: "Ortaköy'de Akşam Yemeği",
        location: "Ortaköy",
        description: "Ortaköy Camii manzarasında kumpir ve waffle keyfi.",
        cost: 250,
        category: "yemek",
        image: "/activities/ortakoy.jpg"
      }
    ]
  },
  {
    day: 3,
    date: "17 Aralık 2023, Pazar",
    activities: [
      {
        id: 11,
        time: "09:00 - 12:00",
        type: "morning",
        title: "Dolmabahçe Sarayı Turu",
        location: "Beşiktaş",
        description: "Osmanlı İmparatorluğu'nun son dönemlerine ait muhteşem sarayı keşfedin.",
        cost: 300,
        category: "kültür",
        image: "/activities/dolmabahce.jpg"
      },
      {
        id: 12,
        time: "12:30 - 14:00",
        type: "noon",
        title: "Beşiktaş'ta Öğle Yemeği",
        location: "Beşiktaş",
        description: "Yerel bir restaurantta enfes balık yemekleri.",
        cost: 250,
        category: "yemek",
        image: "/activities/fish.jpg"
      },
      {
        id: 13,
        time: "14:30 - 17:00",
        type: "afternoon",
        title: "İstanbul Modern Sanat Müzesi",
        location: "Karaköy",
        description: "Türkiye'nin ilk modern sanat müzesinde çağdaş sanat eserleri.",
        cost: 180,
        category: "kültür",
        image: "/activities/istanbul-modern.jpg"
      },
      {
        id: 14,
        time: "17:30 - 19:00",
        type: "evening",
        title: "Karaköy Sokakları Keşfi",
        location: "Karaköy",
        description: "İstanbul'un hızla gelişen semtindeki şık kafe ve dükkanları keşfedin.",
        cost: 100,
        category: "gezi",
        image: "/activities/karakoy.jpg"
      },
      {
        id: 15,
        time: "19:30 - 21:30",
        type: "evening",
        title: "Türk Gecesi Show",
        location: "Sultanahmet",
        description: "Geleneksel Türk müziği ve dansları eşliğinde akşam yemeği.",
        cost: 500,
        category: "eğlence",
        image: "/activities/turkish-night.jpg"
      }
    ]
  }
];

// Aktivite tiplerine göre renkler
const typeColors = {
  morning: "bg-yellow-100 border-yellow-300 text-yellow-800",
  noon: "bg-blue-100 border-blue-300 text-blue-800",
  afternoon: "bg-green-100 border-green-300 text-green-800",
  evening: "bg-purple-100 border-purple-300 text-purple-800"
};

// Kategori ikonları
const categoryIcons = {
  kültür: "🏛️",
  yemek: "🍽️",
  gezi: "🚶",
  alışveriş: "🛍️",
  eğlence: "🎭"
};

export default function DailyPlannerPage() {
  const [activeDay, setActiveDay] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const [showDetails, setShowDetails] = useState<number | null>(null);
  
  const currentDay = sampleItinerary.find(day => day.day === activeDay);
  
  const filteredActivities = currentDay?.activities.filter(activity => 
    filterType === "all" || activity.type === filterType
  ) || [];
  
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Günlük Plan
            </h1>
            <p className="text-gray-600 mt-2 max-w-2xl">
              İstanbul seyahatinizin günlük aktivite planını görüntüleyin ve düzenleyin.
            </p>
          </div>
          <Link 
            href="/"
            className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors self-start"
          >
            Ana Sayfaya Dön
          </Link>
        </div>

        {/* Day Selection */}
        <div className="bg-white p-4 rounded-xl shadow-md mb-6 overflow-x-auto">
          <div className="flex space-x-2">
            {sampleItinerary.map(day => (
              <button
                key={day.day}
                className={`px-4 py-2 rounded-lg flex-shrink-0 transition-colors ${
                  activeDay === day.day 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setActiveDay(day.day)}
              >
                <div className="font-medium">{day.day}. Gün</div>
                <div className="text-xs mt-1">{day.date.split(',')[0]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Daily Overview */}
        {currentDay && (
          <div className="bg-white p-6 rounded-xl shadow-md mb-8">
            <h2 className="text-xl font-bold mb-4">
              {currentDay.day}. Gün - {currentDay.date}
            </h2>
            
            <div className="flex flex-wrap gap-2 mb-6">
              <button 
                className={`px-3 py-1 rounded-md text-sm ${
                  filterType === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'
                }`}
                onClick={() => setFilterType('all')}
              >
                Tümü
              </button>
              <button 
                className={`px-3 py-1 rounded-md text-sm ${
                  filterType === 'morning' ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700'
                }`}
                onClick={() => setFilterType('morning')}
              >
                Sabah
              </button>
              <button 
                className={`px-3 py-1 rounded-md text-sm ${
                  filterType === 'noon' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'
                }`}
                onClick={() => setFilterType('noon')}
              >
                Öğle
              </button>
              <button 
                className={`px-3 py-1 rounded-md text-sm ${
                  filterType === 'afternoon' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'
                }`}
                onClick={() => setFilterType('afternoon')}
              >
                Öğleden Sonra
              </button>
              <button 
                className={`px-3 py-1 rounded-md text-sm ${
                  filterType === 'evening' ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700'
                }`}
                onClick={() => setFilterType('evening')}
              >
                Akşam
              </button>
            </div>
            
            {/* Timeline */}
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute top-0 bottom-0 left-[15px] md:left-[23px] w-0.5 bg-gray-200"></div>
              
              <div className="space-y-6">
                {filteredActivities.map(activity => (
                  <div key={activity.id} className="relative pl-10 md:pl-16">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-2 w-[30px] h-[30px] rounded-full border-4 flex items-center justify-center
                      ${activity.type === 'morning' ? 'bg-yellow-50 border-yellow-400' : 
                        activity.type === 'noon' ? 'bg-blue-50 border-blue-400' : 
                        activity.type === 'afternoon' ? 'bg-green-50 border-green-400' : 
                        'bg-purple-50 border-purple-400'
                      }`}>
                      {categoryIcons[activity.category as keyof typeof categoryIcons]}
                    </div>
                    
                    {/* Activity card */}
                    <div 
                      className={`border rounded-lg overflow-hidden shadow-sm transition-all ${
                        showDetails === activity.id ? 'shadow-md' : ''
                      } ${
                        activity.type === 'morning' ? 'border-yellow-200' : 
                        activity.type === 'noon' ? 'border-blue-200' : 
                        activity.type === 'afternoon' ? 'border-green-200' : 
                        'border-purple-200'
                      }`}
                    >
                      <div 
                        className="p-4 cursor-pointer"
                        onClick={() => setShowDetails(showDetails === activity.id ? null : activity.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-lg">{activity.title}</h3>
                            <div className="text-sm text-gray-500 mt-1">{activity.time} • {activity.location}</div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="text-sm font-medium text-blue-600">{activity.cost > 0 ? `${activity.cost} TL` : 'Ücretsiz'}</div>
                            <div className={`mt-1 text-xs px-2 py-0.5 rounded-full ${
                              typeColors[activity.type as keyof typeof typeColors]
                            }`}>
                              {activity.type === 'morning' ? 'Sabah' : 
                               activity.type === 'noon' ? 'Öğle' : 
                               activity.type === 'afternoon' ? 'Öğleden Sonra' : 
                               'Akşam'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Details section */}
                      {showDetails === activity.id && (
                        <div className="px-4 pb-4">
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-sm text-gray-700 mb-3">{activity.description}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                                  {categoryIcons[activity.category as keyof typeof categoryIcons]} {activity.category}
                                </span>
                              </div>
                              <div className="flex space-x-2">
                                <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors">
                                  Düzenle
                                </button>
                                <button className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-md hover:bg-red-200 transition-colors">
                                  Kaldır
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Daily Summary */}
        {currentDay && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Cost Summary */}
            <div className="bg-white p-4 rounded-xl shadow-md">
              <h3 className="font-medium text-lg mb-3">Günlük Maliyet</h3>
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {currentDay.activities.reduce((sum, act) => sum + act.cost, 0)} TL
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Yemek</span>
                  <span className="font-medium">
                    {currentDay.activities
                      .filter(a => a.category === 'yemek')
                      .reduce((sum, a) => sum + a.cost, 0)} TL
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Kültür</span>
                  <span className="font-medium">
                    {currentDay.activities
                      .filter(a => a.category === 'kültür')
                      .reduce((sum, a) => sum + a.cost, 0)} TL
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Diğer</span>
                  <span className="font-medium">
                    {currentDay.activities
                      .filter(a => !['yemek', 'kültür'].includes(a.category))
                      .reduce((sum, a) => sum + a.cost, 0)} TL
                  </span>
                </div>
              </div>
            </div>
            
            {/* Activity Stats */}
            <div className="bg-white p-4 rounded-xl shadow-md">
              <h3 className="font-medium text-lg mb-3">Aktivite Özeti</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-800">{currentDay.activities.length}</div>
                  <div className="text-xs text-gray-500">Toplam Aktivite</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-800">
                    {Math.round(currentDay.activities.reduce((sum, a) => {
                      const [start, end] = a.time.split(' - ');
                      const startTime = start.split(':').map(Number);
                      const endTime = end.split(':').map(Number);
                      return sum + (endTime[0] - startTime[0]) + (endTime[1] - startTime[1])/60;
                    }, 0))}
                  </div>
                  <div className="text-xs text-gray-500">Toplam Saat</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {currentDay.activities.filter(a => a.type === 'morning').length}
                  </div>
                  <div className="text-xs text-gray-500">Sabah</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {currentDay.activities.filter(a => a.type === 'evening').length}
                  </div>
                  <div className="text-xs text-gray-500">Akşam</div>
                </div>
              </div>
            </div>
            
            {/* Add New Activity */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col justify-center items-center">
              <h3 className="font-medium text-lg text-blue-800 mb-3">Yeni Aktivite Ekle</h3>
              <p className="text-sm text-blue-600 text-center mb-4">
                Bu güne yeni bir aktivite ekleyerek seyahat planınızı kişiselleştirin.
              </p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Aktivite Ekle
              </button>
            </div>
          </div>
        )}
        
        {/* Tips for the day */}
        {currentDay && (
          <div className="bg-white p-6 rounded-xl shadow-md mb-8">
            <h3 className="font-medium text-lg mb-4">Bugün İçin İpuçları</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    {currentDay.day === 1 && "Sultanahmet bölgesindeki müzeler genellikle kalabalık olur. Ayasofya ziyaretiniz için sabah erken saatleri tercih edin."}
                    {currentDay.day === 2 && "Boğaz turu için hava durumunu kontrol etmeyi unutmayın. Hafif bir yağmur ihtimali var."}
                    {currentDay.day === 3 && "Dolmabahçe Sarayı Pazartesi günleri kapalıdır. Önceden bilet alırsanız sıra beklemezsiniz."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
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
