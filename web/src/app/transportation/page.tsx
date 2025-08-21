"use client";

import Link from "next/link";
import { useState } from "react";

// Örnek veriler
const sampleTransportations = [
  {
    id: 1,
    type: "Uçak",
    company: "THY",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2023-12-15",
    departureTime: "08:45",
    arrivalDate: "2023-12-15",
    arrivalTime: "09:50",
    price: 1250,
    duration: "1s 5dk",
    seats: 12
  },
  {
    id: 2,
    type: "Uçak",
    company: "Pegasus",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2023-12-15",
    departureTime: "10:30",
    arrivalDate: "2023-12-15", 
    arrivalTime: "11:40",
    price: 950,
    duration: "1s 10dk",
    seats: 8
  },
  {
    id: 3,
    type: "Otobüs",
    company: "Metro Turizm",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2023-12-15",
    departureTime: "21:00",
    arrivalDate: "2023-12-16",
    arrivalTime: "05:00",
    price: 550,
    duration: "8s",
    seats: 24
  },
  {
    id: 4,
    type: "Otobüs",
    company: "Kamil Koç",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2023-12-15",
    departureTime: "22:30",
    arrivalDate: "2023-12-16",
    arrivalTime: "06:30",
    price: 600,
    duration: "8s",
    seats: 16
  },
  {
    id: 5,
    type: "Tren",
    company: "TCDD",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2023-12-15",
    departureTime: "18:00",
    arrivalDate: "2023-12-16",
    arrivalTime: "00:30", 
    price: 650,
    duration: "6s 30dk",
    seats: 30
  }
];

export default function TransportationPage() {
  const [from, setFrom] = useState("Ankara");
  const [to, setTo] = useState("İstanbul");
  const [date, setDate] = useState("2023-12-15");
  const [type, setType] = useState("all");
  const [sortBy, setSortBy] = useState("price");
  
  const filteredTransportations = sampleTransportations
    .filter(t => type === "all" || t.type === type)
    .sort((a, b) => {
      if (sortBy === "price") return a.price - b.price;
      if (sortBy === "duration") return a.duration.localeCompare(b.duration);
      if (sortBy === "departureTime") return a.departureTime.localeCompare(b.departureTime);
      return 0;
    });

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-blue-800">
              Ulaşım Seçenekleri
            </h1>
            <p className="text-gray-800 mt-2 max-w-2xl">
              Seyahatiniz için en uygun ulaşım seçeneklerini bulun ve karşılaştırın.
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
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4 text-blue-700">Ulaşım Ara</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="from" className="block text-sm font-medium text-blue-700 mb-1">Nereden</label>
              <select 
                id="from" 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                <option value="Ankara" className="text-gray-800 font-medium">Ankara</option>
                <option value="İstanbul" className="text-gray-800 font-medium">İstanbul</option>
                <option value="İzmir" className="text-gray-800 font-medium">İzmir</option>
                <option value="Antalya" className="text-gray-800 font-medium">Antalya</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-blue-700 mb-1">Nereye</label>
              <select 
                id="to" 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                <option value="İstanbul" className="text-gray-800 font-medium">İstanbul</option>
                <option value="Ankara" className="text-gray-800 font-medium">Ankara</option>
                <option value="İzmir" className="text-gray-800 font-medium">İzmir</option>
                <option value="Antalya" className="text-gray-800 font-medium">Antalya</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-blue-700 mb-1">Tarih</label>
              <input 
                type="date" 
                id="date" 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-blue-700 mb-1">Ulaşım Tipi</label>
              <select 
                id="type" 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="all" className="text-gray-800 font-medium">Tümü</option>
                <option value="Uçak" className="text-gray-800 font-medium">Uçak</option>
                <option value="Otobüs" className="text-gray-800 font-medium">Otobüs</option>
                <option value="Tren" className="text-gray-800 font-medium">Tren</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button 
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Ara
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-blue-700">Sonuçlar ({filteredTransportations.length})</h2>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-800 font-medium">Sırala:</span>
              <select 
                className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="price" className="text-gray-800 font-medium">Fiyat</option>
                <option value="duration" className="text-gray-800 font-medium">Süre</option>
                <option value="departureTime" className="text-gray-800 font-medium">Kalkış Zamanı</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-4">
            {filteredTransportations.map(transport => (
              <div 
                key={transport.id} 
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                  <div className="flex items-center mb-4 md:mb-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-3 ${
                      transport.type === "Uçak" ? "bg-blue-100 text-blue-600" : 
                      transport.type === "Otobüs" ? "bg-green-100 text-green-600" : 
                      "bg-purple-100 text-purple-600"
                    }`}>
                      {transport.type === "Uçak" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      ) : transport.type === "Otobüs" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h8m-4 5v-1m4-1v1m-8-1v1m-1-8h10a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-blue-800">{transport.company}</div>
                      <div className="text-sm text-gray-800 font-medium">{transport.type}</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
                    <div className="text-center">
                      <div className="font-bold text-blue-700">{transport.departureTime}</div>
                      <div className="text-sm text-gray-800 font-medium">{transport.from}</div>
                    </div>
                    
                    <div className="hidden md:block">
                      <div className="w-24 h-[2px] bg-gray-300 relative">
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-800 font-medium">
                          {transport.duration}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="font-bold text-blue-700">{transport.arrivalTime}</div>
                      <div className="text-sm text-gray-800 font-medium">{transport.to}</div>
                    </div>
                    
                    <div className="md:ml-4">
                      <div className="font-bold text-blue-600">{transport.price} TL</div>
                      <div className="text-xs text-gray-800 font-medium">{transport.seats} koltuk kaldı</div>
                    </div>
                    
                    <button 
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                    >
                      Seç
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Coming Soon Message */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
          <p className="text-yellow-800">
            <strong>Bilgilendirme:</strong> Bu özellik şu an demo amaçlıdır. Gerçek rezervasyon yakında aktif olacaktır.
          </p>
        </div>
        
        <div className="mt-8 text-sm text-gray-800 font-medium text-center">
          &copy; {new Date().getFullYear()} Trip Planner - Tüm hakları saklıdır.
        </div>
      </div>
    </main>
  );
}
