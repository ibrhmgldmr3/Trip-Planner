"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

interface POI {
  id: string;
  name: string;
  vicinity: string;
  rating?: number;
  types: string[];
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  photos?: any[];
  price_level?: number;
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [map, setMap] = useState<any>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    const loadGoogleMaps = () => {
      // Google Maps API'yi yükle
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (mapRef.current && (window as any).google) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapInstance = new (window as any).google.maps.Map(mapRef.current, {
            zoom: 13,
            center: { lat: 39.9334, lng: 32.8597 }, // Türkiye/Ankara
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP,
          });
          
          setMap(mapInstance);
          setCurrentLocation({ lat: 39.9334, lng: 32.8597 });
        }
      };
      
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // POI'leri getir
  const fetchPOIs = () => {
    if (!map || !currentLocation) {
      toast.error('Harita henüz yüklenmedi!');
      return;
    }

    setLoading(true);
    console.log('POI aranıyor...', currentLocation);
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new (window as any).google.maps.places.PlacesService(map);
      
      const request = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        location: new (window as any).google.maps.LatLng(currentLocation.lat, currentLocation.lng),
        radius: 3000, // 3km radius (daha küçük radius)
        types: ['tourist_attraction'] // Sadece turistik yerler
      };

      console.log('Places API isteği:', request);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service.nearbySearch(request, (results: any[], status: any) => {
        console.log('Places API yanıtı:', status, results);
        setLoading(false);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const PlacesServiceStatus = (window as any).google.maps.places.PlacesServiceStatus;
        
        if (status === PlacesServiceStatus.OK && results && results.length > 0) {
          setPois(results.slice(0, 8)); // İlk 8 sonucu al
          toast.success(`${Math.min(results.length, 8)} yer bulundu!`);
          
          // Haritaya marker'ları ekle
          results.slice(0, 8).forEach((place, index) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (window as any).google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name,
              label: (index + 1).toString(),
              icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                scaledSize: new (window as any).google.maps.Size(32, 32)
              }
            });
          });
        } else if (status === PlacesServiceStatus.ZERO_RESULTS) {
          toast.error('Bu bölgede hiç yer bulunamadı!');
          setPois([]);
        } else if (status === PlacesServiceStatus.OVER_QUERY_LIMIT) {
          toast.error('API kullanım limitini aştınız!');
        } else if (status === PlacesServiceStatus.REQUEST_DENIED) {
          toast.error('API erişimi reddedildi!');
        } else {
          console.error('Places API hatası:', status);
          toast.error('Yerler yüklenirken hata oluştu!');
        }
      });
      
      // 10 saniye timeout ekle
      setTimeout(() => {
        if (loading) {
          setLoading(false);
          toast.error('İstek zaman aşımına uğradı!');
        }
      }, 10000);
      
    } catch (error) {
      console.error('POI getirme hatası:', error);
      setLoading(false);
      toast.error('Bir hata oluştu!');
    }
  };

  // Belirli türde POI'leri getir
  const fetchPOIsByType = (types: string[]) => {
    if (!map || !currentLocation) {
      toast.error('Harita henüz yüklenmedi!');
      return;
    }

    setLoading(true);
    console.log('Belirli türde POI aranıyor...', types, currentLocation);
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new (window as any).google.maps.places.PlacesService(map);
      
      const request = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        location: new (window as any).google.maps.LatLng(currentLocation.lat, currentLocation.lng),
        radius: 2000, // 2km radius
        types: types
      };

      console.log('Places API isteği (tür):', request);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service.nearbySearch(request, (results: any[], status: any) => {
        console.log('Places API yanıtı (tür):', status, results);
        setLoading(false);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const PlacesServiceStatus = (window as any).google.maps.places.PlacesServiceStatus;
        
        if (status === PlacesServiceStatus.OK && results && results.length > 0) {
          setPois(results.slice(0, 8));
          toast.success(`${Math.min(results.length, 8)} yer bulundu!`);
          
          // Önceki marker'ları temizle
          // Bu basit implementation'da marker'ları temizlemiyoruz
          
          // Haritaya marker'ları ekle
          results.slice(0, 8).forEach((place, index) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (window as any).google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name,
              label: (index + 1).toString(),
              icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                scaledSize: new (window as any).google.maps.Size(32, 32)
              }
            });
          });
        } else if (status === PlacesServiceStatus.ZERO_RESULTS) {
          toast.error('Bu bölgede bu türde yer bulunamadı!');
          setPois([]);
        } else if (status === PlacesServiceStatus.OVER_QUERY_LIMIT) {
          toast.error('API kullanım limitini aştınız!');
        } else if (status === PlacesServiceStatus.REQUEST_DENIED) {
          toast.error('API erişimi reddedildi!');
        } else {
          console.error('Places API hatası:', status);
          toast.error('Yerler yüklenirken hata oluştu!');
        }
      });
      
      // 10 saniye timeout ekle
      setTimeout(() => {
        if (loading) {
          setLoading(false);
          toast.error('İstek zaman aşımına uğradı!');
        }
      }, 10000);
      
    } catch (error) {
      console.error('POI getirme hatası:', error);
      setLoading(false);
      toast.error('Bir hata oluştu!');
    }
  };

  // Mevcut konumu al
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          setCurrentLocation(pos);
          if (map) {
            map.setCenter(pos);
            map.setZoom(15);
            
            // Mevcut konum marker'ı
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (window as any).google.maps.Marker({
              position: pos,
              map: map,
              title: 'Mevcut Konumunuz',
              icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                scaledSize: new (window as any).google.maps.Size(40, 40)
              }
            });
          }
          toast.success('Konumunuz bulundu!');
        },
        () => {
          toast.error('Konum erişimi reddedildi!');
        }
      );
    }
  };

  // POI türlerini Türkçe'ye çevir
  const translateType = (type: string): string => {
    const translations: Record<string, string> = {
      'tourist_attraction': '🏛️ Turistik Yer',
      'restaurant': '🍽️ Restoran',
      'museum': '🏛️ Müze',
      'park': '🌳 Park',
      'shopping_mall': '🛍️ AVM',
      'gas_station': '⛽ Benzinlik',
      'hospital': '🏥 Hastane',
      'bank': '🏦 Banka',
      'atm': '🏧 ATM',
      'pharmacy': '💊 Eczane',
      'lodging': '🏨 Konaklama',
      'food': '🍴 Yemek',
      'establishment': '🏢 İşletme',
      'point_of_interest': '📍 İlgi Noktası'
    };
    return translations[type] || `📍 ${type}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
            🗺️ Harita
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Seyahat rotalarınızı keşfedin
          </p>
        </div>

        {/* Map Container */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          {/* Map Controls */}
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={getCurrentLocation}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
            >
              <span>📍</span>
              <span>Konumumu Bul</span>
            </button>
            
            <button
              onClick={fetchPOIs}
              disabled={loading || !map}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2 disabled:bg-gray-400"
            >
              <span>🏛️</span>
              <span>{loading ? 'Yükleniyor...' : 'Turistik Yerler'}</span>
            </button>
            
            <button
              onClick={() => fetchPOIsByType(['restaurant', 'cafe', 'food'])}
              disabled={loading || !map}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2 disabled:bg-gray-400"
            >
              <span>🍽️</span>
              <span>{loading ? 'Yükleniyor...' : 'Restoranlar'}</span>
            </button>
            
            <button
              onClick={() => fetchPOIsByType(['lodging', 'hotel'])}
              disabled={loading || !map}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center space-x-2 disabled:bg-gray-400"
            >
              <span>🏨</span>
              <span>{loading ? 'Yükleniyor...' : 'Oteller'}</span>
            </button>
            
            {pois.length > 0 && (
              <button
                onClick={() => {
                  setPois([]);
                  toast.success('Harita temizlendi!');
                }}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center space-x-2"
              >
                <span>🗑️</span>
                <span>Temizle</span>
              </button>
            )}
            
            {pois.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 px-3 py-2 rounded-full">
                  {pois.length} yer bulundu
                </span>
              </div>
            )}
          </div>
          
          <div 
            ref={mapRef}
            className="w-full h-96 rounded-lg border border-gray-200 dark:border-gray-700"
            style={{ minHeight: '400px' }}
          >
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">Harita yükleniyor...</p>
              </div>
            </div>
          </div>
        </div>

        {/* POI Listesi */}
        {pois.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
              📍 Yakındaki İlgi Çekici Yerler
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pois.map((poi, index) => (
                <div
                  key={poi.id || index}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">
                      {poi.name}
                    </h3>
                    {poi.rating && (
                      <div className="flex items-center space-x-1 bg-yellow-100 dark:bg-yellow-900/20 px-2 py-1 rounded-full">
                        <span className="text-yellow-500">⭐</span>
                        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                          {poi.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    📍 {poi.vicinity}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {poi.types.slice(0, 3).map((type, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 px-2 py-1 rounded-full"
                      >
                        {translateType(type)}
                      </span>
                    ))}
                  </div>
                  
                  {poi.price_level !== undefined && (
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Fiyat:</span>
                      <div className="flex">
                        {[...Array(5)].map((_, idx) => (
                          <span
                            key={idx}
                            className={`text-sm ${
                              idx < poi.price_level! 
                                ? 'text-green-500' 
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          >
                            💰
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Koordinat: {poi.geometry.location.lat().toFixed(4)}, {poi.geometry.location.lng().toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="text-center mt-8">
          <a
            href="/daily-planner"
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors mr-4"
          >
            📅 Günlük Planlayıcı
          </a>
          <a
            href="/my-plans"
            className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors"
          >
            📋 Planlarım
          </a>
        </div>
      </div>
    </div>
  );
}
