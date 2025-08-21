"use client";

import Link from "next/link";
import { useState } from "react";

// Örnek veriler
const otelOrnekleri = [
  {
    id: 1,
    name: "Grand Istanbul Hotel",
    city: "İstanbul",
    district: "Beyoğlu",
    yildiz: 5,
    rating: 4.7,
    reviewCount: 1254,
    ucret: 1850,
    amenities: ["Havuz", "Spa", "Restoran", "Ücretsiz WiFi", "Klima", "Bar"],
    image: "/hotels/hotel1.jpg",
    distanceToCenter: "1.2 km"
  },
  {
    id: 2,
    name: "Blue Bosphorus Suite",
    city: "İstanbul",
    district: "Beşiktaş",
    yildiz: 4,
    rating: 4.5,
    reviewCount: 876,
    ucret: 1200,
    amenities: ["Manzara", "Restoran", "Ücretsiz WiFi", "Klima"],
    image: "/hotels/hotel2.jpg",
    distanceToCenter: "2.5 km"
  },
  {
    id: 3,
    name: "Ottoman Palace Hotel",
    city: "İstanbul",
    district: "Sultanahmet",
    yildiz: 5,
    rating: 4.8,
    reviewCount: 2130,
    ucret: 2200,
    amenities: ["Havuz", "Spa", "Restoran", "Ücretsiz WiFi", "Klima", "Bar", "Fitness Merkezi"],
    image: "/hotels/hotel3.jpg",
    distanceToCenter: "0.5 km"
  },
  {
    id: 4,
    name: "Taksim Central Hostel",
    city: "İstanbul",
    district: "Taksim",
    yildiz: 3,
    rating: 4.2,
    reviewCount: 543,
    ucret: 450,
    amenities: ["Ücretsiz WiFi", "Ortak Mutfak", "24-Saat Resepsiyon"],
    image: "/hotels/hotel4.jpg",
    distanceToCenter: "0.8 km"
  },
  {
    id: 5,
    name: "Galata Boutique Hotel",
    city: "İstanbul",
    district: "Karaköy",
    yildiz: 4,
    rating: 4.6,
    reviewCount: 768,
    ucret: 950,
    amenities: ["Restoran", "Ücretsiz WiFi", "Klima", "Bar", "Teras"],
    image: "/hotels/hotel5.jpg",
    distanceToCenter: "1.7 km"
  }
];

export default function AccommodationPage() {
  const [city, setCity] = useState("İstanbul");
  const [checkIn, setCheckIn] = useState("2023-12-15");
  const [checkOut, setCheckOut] = useState("2023-12-18");
  const [guests, setGuests] = useState(2);
  const [minyildiz, setMinYildiz] = useState(0);
  const [maxucret, setMaxUcret] = useState(5000);
  const [sortBy, setSortBy] = useState("recommended");
  
  const filtrelenmisOteller = otelOrnekleri
    .filter(hotel => hotel.yildiz >= minyildiz && hotel.ucret <= maxucret)
    .sort((a, b) => {
      if (sortBy === "ucret") return a.ucret - b.ucret;
      if (sortBy === "yildiz") return b.yildiz - a.yildiz;
      if (sortBy === "rating") return b.rating - a.rating;
      return 0; // recommended
    });

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Konaklama Seçenekleri
            </h1>
            <p className="text-gray-300 mt-2 max-w-2xl">
              Seyahatiniz için en uygun konaklama tesislerini keşfedin ve rezervasyon yapın.
            </p>
          </div>
          <Link 
            href="/"
            className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors self-start"
          >
            Ana Sayfaya Dön
          </Link>
        </div>

        {/* Search Form */}
        <div className="bg-gray-800 p-6 rounded-xl shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white">Konaklama Ara</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-300 mb-1">Şehir</label>
              <select 
                id="city" 
                className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="İstanbul" className="text-white">İstanbul</option>
                <option value="Ankara" className="text-white">Ankara</option>
                <option value="İzmir" className="text-white">İzmir</option>
                <option value="Antalya" className="text-white">Antalya</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="checkIn" className="block text-sm font-medium text-gray-300 mb-1">Giriş Tarihi</label>
              <input 
                type="date" 
                id="checkIn" 
                className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="checkOut" className="block text-sm font-medium text-gray-300 mb-1">Çıkış Tarihi</label>
              <input 
                type="date" 
                id="checkOut" 
                className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="guests" className="block text-sm font-medium text-gray-300 mb-1">Misafir Sayısı</label>
              <select 
                id="guests" 
                className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
              >
                <option value="1" className="text-white">1 Kişi</option>
                <option value="2" className="text-white">2 Kişi</option>
                <option value="3" className="text-white">3 Kişi</option>
                <option value="4" className="text-white">4 Kişi</option>
                <option value="5" className="text-white">5 Kişi</option>
                <option value="6" className="text-white">6+ Kişi</option>
              </select>
            </div>
            
            <div className="flex justify-end">
              <button 
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Ara
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Filters */}
          <div className="md:col-span-1">
            <div className="bg-gray-800 p-4 rounded-xl shadow-md">
              <h3 className="font-medium text-lg mb-4 text-blue-400">Filtreler</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-300 mb-2">Fiyat Aralığı</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-300">0 TL</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="5000" 
                      step="100"
                      value={maxucret}
                      onChange={(e) => setMaxUcret(Number(e.target.value))}
                      className="w-full h-2 bg-blue-900 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm text-gray-300">{maxucret} TL</span>
                  </div>
                  <div className="text-xs text-right text-gray-300 font-medium mt-1">Max: {maxucret} TL</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-300 mb-2">Yıldız Sayısı</label>
                  <div className="flex items-center gap-4">
                    {[0, 3, 4, 5].map(yildiz => (
                      <label key={yildiz} className="flex items-center">
                        <input 
                          type="radio" 
                          name="yildiz" 
                          value={yildiz} 
                          checked={minyildiz === yildiz}
                          onChange={() => setMinYildiz(yildiz)}
                          className="mr-1"
                        />
                        <span className="text-gray-300">
                          {yildiz === 0 ? 'Tümü' : 
                            [...Array(yildiz)].map((_, i) => (
                              <span key={i} className="text-yellow-400">★</span>
                            ))
                          }
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-300 mb-2">Sıralama</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="recommended" className="text-white">Önerilen</option>
                    <option value="ucret" className="text-white">Fiyat (Artan)</option>
                    <option value="yildiz" className="text-white">Yıldız Sayısı</option>
                    <option value="rating" className="text-white">Misafir Puanı</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-300 mb-2">Olanaklar</label>
                  <div className="space-y-2">
                    {['Havuz', 'Spa', 'Ücretsiz WiFi', 'Restoran', 'Bar'].map(amenity => (
                      <label key={amenity} className="flex items-center">
                        <input type="checkbox" className="mr-2" />
                        <span className="text-sm text-gray-300">{amenity}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Results */}
          <div className="md:col-span-2 lg:col-span-3">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-blue-400">
                {city} Otelleri <span className="text-sm text-gray-300 font-medium">({filtrelenmisOteller.length} sonuç)</span>
              </h2>
            </div>
            
            <div className="space-y-4">
              {filtrelenmisOteller.map(hotel => (
                <div key={hotel.id} className="bg-gray-800 rounded-xl shadow-md overflow-hidden">
                  <div className="md:flex">
                    <div className="md:w-1/3 h-48 md:h-auto bg-gray-700 flex items-center justify-center">
                      <div className="bg-blue-900 text-blue-300 w-full h-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="p-4 md:p-6 flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold mb-1 text-blue-400">{hotel.name}</h3>
                          <div className="flex items-center mb-2">
                            {[...Array(hotel.yildiz)].map((_, i) => (
                              <span key={i} className="text-yellow-400">★</span>
                            ))}
                            <span className="text-sm text-gray-300 font-medium ml-2">{hotel.district}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="bg-blue-900 text-blue-300 rounded-lg px-2 py-1 text-sm font-semibold">
                            {hotel.rating}/5
                          </div>
                          <div className="text-xs text-gray-300 font-medium mt-1">
                            {hotel.reviewCount} değerlendirme
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-1">
                        {hotel.amenities.slice(0, 5).map(amenity => (
                          <span key={amenity} className="inline-block bg-gray-700 rounded-full px-2 py-1 text-xs text-gray-300 font-medium">
                            {amenity}
                          </span>
                        ))}
                        {hotel.amenities.length > 5 && (
                          <span className="inline-block bg-gray-700 rounded-full px-2 py-1 text-xs text-gray-300 font-medium">
                            +{hotel.amenities.length - 5} daha
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between">
                        <div>
                          <div className="text-xs text-gray-300 font-medium">Merkeze {hotel.distanceToCenter} mesafede</div>
                          <div className="text-xs text-gray-300 font-medium">{checkIn} - {checkOut}, {guests} kişi</div>
                        </div>
                        <div className="mt-2 md:mt-0 flex flex-col items-end">
                          <div className="text-lg font-bold text-blue-400">{hotel.ucret} TL <span className="text-sm text-gray-300 font-medium">/ gece</span></div>
                          <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                            Rezervasyon Yap
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Coming Soon Message */}
        <div className="mt-8 text-center text-gray-300 font-medium">
          <p className="text-sm">Bu sayfa henüz tamamlanmadı.</p>
        </div>

        <div className="mt-8 text-sm text-gray-300 font-medium text-center">
          &copy; {new Date().getFullYear()} Trip Planner - Tüm hakları saklıdır.
        </div>
      </div>
    </main>
  );
}
