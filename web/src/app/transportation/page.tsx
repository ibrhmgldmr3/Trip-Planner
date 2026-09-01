"use client";

import Link from "next/link";
import { useState } from "react";

// Örnek veriler - Çeşitli tarihlerde ulaşım seçenekleri
const sampleTransportations = [
  // 26 Ağustos 2025 - Ankara > İstanbul
  {
    id: 1,
    type: "Uçak",
    company: "THY",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-26",
    departureTime: "08:45",
    arrivalDate: "2025-08-26",
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
    departureDate: "2025-08-26",
    departureTime: "10:30",
    arrivalDate: "2025-08-26", 
    arrivalTime: "11:40",
    price: 950,
    duration: "1s 10dk",
    seats: 8
  },
  {
    id: 3,
    type: "Uçak",
    company: "AnadoluJet",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-26",
    departureTime: "16:20",
    arrivalDate: "2025-08-26",
    arrivalTime: "17:30",
    price: 1100,
    duration: "1s 10dk",
    seats: 25
  },
  {
    id: 4,
    type: "Otobüs",
    company: "Metro Turizm",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-26",
    departureTime: "21:00",
    arrivalDate: "2025-08-27",
    arrivalTime: "05:00",
    price: 550,
    duration: "8s",
    seats: 24
  },
  {
    id: 5,
    type: "Otobüs",
    company: "Kamil Koç",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-26",
    departureTime: "22:30",
    arrivalDate: "2025-08-27",
    arrivalTime: "06:30",
    price: 600,
    duration: "8s",
    seats: 16
  },
  {
    id: 6,
    type: "Otobüs",
    company: "Pamukkale Turizm",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-26",
    departureTime: "23:15",
    arrivalDate: "2025-08-27",
    arrivalTime: "07:15",
    price: 580,
    duration: "8s",
    seats: 32
  },
  {
    id: 7,
    type: "Tren",
    company: "TCDD YHT",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-26",
    departureTime: "18:00",
    arrivalDate: "2025-08-26",
    arrivalTime: "22:45", 
    price: 850,
    duration: "4s 45dk",
    seats: 45
  },
  {
    id: 8,
    type: "Tren",
    company: "TCDD",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-26",
    departureTime: "06:30",
    arrivalDate: "2025-08-26",
    arrivalTime: "11:15", 
    price: 650,
    duration: "4s 45dk",
    seats: 30
  },

  // 27 Ağustos 2025 - Ankara > İstanbul
  {
    id: 9,
    type: "Uçak",
    company: "THY",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-27",
    departureTime: "07:30",
    arrivalDate: "2025-08-27",
    arrivalTime: "08:35",
    price: 1350,
    duration: "1s 5dk",
    seats: 18
  },
  {
    id: 10,
    type: "Uçak",
    company: "Pegasus",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-27",
    departureTime: "14:15",
    arrivalDate: "2025-08-27", 
    arrivalTime: "15:25",
    price: 980,
    duration: "1s 10dk",
    seats: 12
  },
  {
    id: 11,
    type: "Otobüs",
    company: "Metro Turizm",
    from: "Ankara",
    to: "İstanbul",
    departureDate: "2025-08-27",
    departureTime: "20:30",
    arrivalDate: "2025-08-28",
    arrivalTime: "04:30",
    price: 570,
    duration: "8s",
    seats: 28
  },

  // 28 Ağustos 2025 - İstanbul > İzmir
  {
    id: 12,
    type: "Uçak",
    company: "THY",
    from: "İstanbul",
    to: "İzmir",
    departureDate: "2025-08-28",
    departureTime: "09:20",
    arrivalDate: "2025-08-28",
    arrivalTime: "10:35",
    price: 1180,
    duration: "1s 15dk",
    seats: 22
  },
  {
    id: 13,
    type: "Uçak",
    company: "Pegasus",
    from: "İstanbul",
    to: "İzmir",
    departureDate: "2025-08-28",
    departureTime: "13:45",
    arrivalDate: "2025-08-28", 
    arrivalTime: "15:00",
    price: 890,
    duration: "1s 15dk",
    seats: 15
  },
  {
    id: 14,
    type: "Otobüs",
    company: "Pamukkale Turizm",
    from: "İstanbul",
    to: "İzmir",
    departureDate: "2025-08-28",
    departureTime: "22:00",
    arrivalDate: "2025-08-29",
    arrivalTime: "06:00",
    price: 420,
    duration: "8s",
    seats: 35
  },
  {
    id: 15,
    type: "Otobüs",
    company: "Kamil Koç",
    from: "İstanbul",
    to: "İzmir",
    departureDate: "2025-08-28",
    departureTime: "23:30",
    arrivalDate: "2025-08-29",
    arrivalTime: "07:30",
    price: 450,
    duration: "8s",
    seats: 18
  },

  // 29 Ağustos 2025 - İzmir > Antalya
  {
    id: 16,
    type: "Uçak",
    company: "THY",
    from: "İzmir",
    to: "Antalya",
    departureDate: "2025-08-29",
    departureTime: "11:30",
    arrivalDate: "2025-08-29",
    arrivalTime: "12:45",
    price: 1320,
    duration: "1s 15dk",
    seats: 8
  },
  {
    id: 17,
    type: "Uçak",
    company: "AnadoluJet",
    from: "İzmir",
    to: "Antalya",
    departureDate: "2025-08-29",
    departureTime: "17:20",
    arrivalDate: "2025-08-29", 
    arrivalTime: "18:35",
    price: 1050,
    duration: "1s 15dk",
    seats: 20
  },
  {
    id: 18,
    type: "Otobüs",
    company: "Metro Turizm",
    from: "İzmir",
    to: "Antalya",
    departureDate: "2025-08-29",
    departureTime: "21:45",
    arrivalDate: "2025-08-30",
    arrivalTime: "05:45",
    price: 380,
    duration: "8s",
    seats: 40
  },

  // 30 Ağustos 2025 - Antalya > Ankara
  {
    id: 19,
    type: "Uçak",
    company: "THY",
    from: "Antalya",
    to: "Ankara",
    departureDate: "2025-08-30",
    departureTime: "08:15",
    arrivalDate: "2025-08-30",
    arrivalTime: "09:45",
    price: 1450,
    duration: "1s 30dk",
    seats: 14
  },
  {
    id: 20,
    type: "Uçak",
    company: "Pegasus",
    from: "Antalya",
    to: "Ankara",
    departureDate: "2025-08-30",
    departureTime: "15:50",
    arrivalDate: "2025-08-30", 
    arrivalTime: "17:20",
    price: 1150,
    duration: "1s 30dk",
    seats: 9
  },
  {
    id: 21,
    type: "Otobüs",
    company: "Pamukkale Turizm",
    from: "Antalya",
    to: "Ankara",
    departureDate: "2025-08-30",
    departureTime: "20:00",
    arrivalDate: "2025-08-31",
    arrivalTime: "06:00",
    price: 520,
    duration: "10s",
    seats: 26
  },

  // 31 Ağustos 2025 - Ankara > İzmir
  {
    id: 22,
    type: "Uçak",
    company: "AnadoluJet",
    from: "Ankara",
    to: "İzmir",
    departureDate: "2025-08-31",
    departureTime: "12:40",
    arrivalDate: "2025-08-31",
    arrivalTime: "14:10",
    price: 1280,
    duration: "1s 30dk",
    seats: 11
  },
  {
    id: 23,
    type: "Tren",
    company: "TCDD",
    from: "Ankara",
    to: "İzmir",
    departureDate: "2025-08-31",
    departureTime: "07:45",
    arrivalDate: "2025-08-31",
    arrivalTime: "17:30", 
    price: 780,
    duration: "9s 45dk",
    seats: 38
  },
  {
    id: 24,
    type: "Otobüs",
    company: "Metro Turizm",
    from: "Ankara",
    to: "İzmir",
    departureDate: "2025-08-31",
    departureTime: "22:15",
    arrivalDate: "2025-09-01",
    arrivalTime: "07:15",
    price: 480,
    duration: "9s",
    seats: 31
  }
];

export default function TransportationPage() {
  const [from, setFrom] = useState("Ankara");
  const [to, setTo] = useState("İstanbul");
  const [date, setDate] = useState("2025-08-26");
  const [type, setType] = useState("all");
  const [sortBy, setSortBy] = useState("price");
  
  const filteredTransportations = sampleTransportations
    .filter(t => 
      t.from === from && 
      t.to === to && 
      t.departureDate === date &&
      (type === "all" || t.type === type)
    )
    .sort((a, b) => {
      if (sortBy === "price") return a.price - b.price;
      if (sortBy === "duration") return a.duration.localeCompare(b.duration);
      if (sortBy === "departureTime") return a.departureTime.localeCompare(b.departureTime);
      return 0;
    });

  return (
    <main className="min-h-screen p-4 md:p-8 bg-[var(--surface-2)]">
      <div className="max-w-6xl mx-auto text-[var(--fg-muted)]">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--accent)] dark:text-[var(--accent)]">
              Ulaşım Seçenekleri
            </h1>
            <p className="text-[var(--fg-muted)] mt-2 max-w-2xl">
              Seyahatiniz için en uygun ulaşım seçeneklerini bulun ve karşılaştırın.
            </p>
          </div>
          <Link 
            href="/"
            className="mt-4 md:mt-0 px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors self-start"
          >
            Ana Sayfaya Dön
          </Link>
        </div>

        {/* Search Form */}
        <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--line)] mb-8">
          <h2 className="text-xl font-semibold mb-4 text-[var(--accent)] dark:text-[var(--accent)]">Ulaşım Ara</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="from" className="block text-sm font-medium text-[var(--accent)] mb-1">Nereden</label>
              <select 
                id="from" 
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                <option value="Ankara">Ankara</option>
                <option value="İstanbul">İstanbul</option>
                <option value="İzmir">İzmir</option>
                <option value="Antalya">Antalya</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-[var(--accent)] mb-1">Nereye</label>
              <select 
                id="to" 
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                <option value="İstanbul">İstanbul</option>
                <option value="Ankara">Ankara</option>
                <option value="İzmir">İzmir</option>
                <option value="Antalya">Antalya</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-[var(--accent)] mb-1">Tarih</label>
              <input 
                type="date" 
                id="date" 
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min="2025-08-26"
                max="2025-09-30"
              />
            </div>
            
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-[var(--accent)] mb-1">Ulaşım Tipi</label>
              <select 
                id="type" 
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="all">Tümü</option>
                <option value="Uçak">Uçak</option>
                <option value="Otobüs">Otobüs</option>
                <option value="Tren">Tren</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button 
              type="button"
              className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              Ara
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--line)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[var(--accent)] dark:text-[var(--accent)]">Sonuçlar ({filteredTransportations.length})</h2>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-[var(--fg-muted)] font-medium">Sırala:</span>
              <select 
                className="px-2 py-1 border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg)] rounded-md text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="price">Fiyat</option>
                <option value="duration">Süre</option>
                <option value="departureTime">Kalkış Zamanı</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-4">
            {filteredTransportations.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-xl font-semibold text-[var(--fg-muted)] mb-2">Sonuç Bulunamadı</h3>
                <p className="text-[var(--fg-muted)] mb-4">
                  Seçtiğiniz tarih ve güzergah için ulaşım seçeneği bulunmuyor.
                </p>
                <p className="text-sm text-[var(--fg-subtle)]">
                  Farklı bir tarih veya güzergah deneyebilirsiniz.
                </p>
              </div>
            ) : (
              filteredTransportations.map(transport => (
                <div 
                  key={transport.id} 
                  className="border border-[var(--line)] bg-[var(--surface-2)] rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                    <div className="flex items-center mb-4 md:mb-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-3 ${
                        transport.type === "Uçak" ? "bg-[var(--info-soft)] text-[var(--accent)]" : 
                        transport.type === "Otobüs" ? "bg-[var(--ok-soft)] text-[var(--ok)]" : 
                        "bg-[var(--surface-2)] text-[var(--fg)] dark:text-[var(--fg)]"
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
                        <div className="font-medium text-[var(--accent)]">{transport.company}</div>
                        <div className="text-sm text-[var(--fg-muted)] font-medium">{transport.type}</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
                      <div className="text-center">
                        <div className="font-bold text-[var(--accent)]">{transport.departureTime}</div>
                        <div className="text-sm text-[var(--fg-muted)] font-medium">{transport.from}</div>
                        <div className="text-xs text-[var(--fg-muted)]">{new Date(transport.departureDate).toLocaleDateString('tr-TR')}</div>
                      </div>
                      
                      <div className="hidden md:block">
                        <div className="w-24 h-[2px] bg-[var(--surface-3)] dark:bg-[var(--surface-3)] relative">
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs text-[var(--fg-muted)] font-medium">
                            {transport.duration}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="font-bold text-[var(--accent)]">{transport.arrivalTime}</div>
                        <div className="text-sm text-[var(--fg-muted)] font-medium">{transport.to}</div>
                        <div className="text-xs text-[var(--fg-muted)]">{new Date(transport.arrivalDate).toLocaleDateString('tr-TR')}</div>
                      </div>
                      
                      <div className="md:ml-4">
                        <div className="font-bold text-[var(--accent)]">{transport.price} TL</div>
                        <div className="text-xs text-[var(--fg-muted)] font-medium">{transport.seats} koltuk kaldı</div>
                      </div>
                      
                      <button 
                        className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg text-sm hover:bg-[var(--accent-hover)] transition-colors"
                      >
                        Seç
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Coming Soon Message */}
        <div className="mt-8 bg-[var(--surface)] border border-[var(--line)] p-4 rounded-lg text-center">
          <p className="text-[var(--warn)] dark:text-[var(--warn)]">
            <strong>Bilgilendirme:</strong> Bu özellik şu an demo amaçlıdır. Gerçek rezervasyon yakında aktif olacaktır.
          </p>
        </div>
        
        <div className="mt-8 text-sm text-[var(--fg-muted)] font-medium text-center">
          &copy; {new Date().getFullYear()} Trip Planner - Tüm hakları saklıdır.
        </div>
      </div>
    </main>
  );
}


