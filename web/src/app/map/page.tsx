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
  const [selectedPois, setSelectedPois] = useState<POI[]>([]);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);

  useEffect(() => {
    const loadGoogleMaps = () => {
      // Google Maps API zaten yüklü mü kontrol et
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google && (window as any).google.maps) {
        console.log('Google Maps API zaten yüklü, haritayı oluşturuluyor...');
        // API zaten yüklü, doğrudan haritayı oluştur
        initializeMap();
        return;
      }

      // Script zaten eklendi mi kontrol et
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        console.log('Google Maps script zaten eklendi, yüklenmesini bekleniyor...');
        // Script eklendi ama henüz yüklenmedi, onload event'ini bekle
        existingScript.addEventListener('load', initializeMap);
        return;
      }

      console.log('Google Maps API yükleniyor...');
      
      // Google Maps API'yi yükle
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Google Maps API başarıyla yüklendi');
        initializeMap();
      };

      script.onerror = () => {
        console.error('Google Maps API yüklenirken hata oluştu');
        toast.error('Harita yüklenirken hata oluştu');
      };
      
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log('Harita oluşturuluyor...', { mapRef: !!mapRef.current, google: !!(window as any).google });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapRef.current && (window as any).google && (window as any).google.maps) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapInstance = new (window as any).google.maps.Map(mapRef.current, {
            zoom: 13,
            center: { lat: 39.9334, lng: 32.8597 }, // Türkiye/Ankara
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP,
          });
          
          console.log('Harita başarıyla oluşturuldu');
          setMap(mapInstance);
          setCurrentLocation({ lat: 39.9334, lng: 32.8597 });
          
          // Directions service'leri oluştur
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const directionsServiceInstance = new (window as any).google.maps.DirectionsService();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const directionsRendererInstance = new (window as any).google.maps.DirectionsRenderer({
            draggable: false,
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: '#4285F4',
              strokeWeight: 4,
              strokeOpacity: 0.8
            }
          });
          
          directionsRendererInstance.setMap(mapInstance);
          setDirectionsService(directionsServiceInstance);
          setDirectionsRenderer(directionsRendererInstance);
        } catch (error) {
          console.error('Harita oluşturulurken hata:', error);
          toast.error('Harita oluşturulamadı');
        }
      } else {
        console.warn('Harita oluşturulamadı - gerekli elemanlar eksik');
      }
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
          
          // Önceki marker'ları temizle (POI marker'larını)
          // Not: Seçili POI'ler korunur, sadece haritadaki marker'lar yenilenir
          
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
      'tourist_attraction': 'Turistik Yer',
      'restaurant': 'Restoran',
      'museum': 'Müze',
      'park': 'Park',
      'shopping_mall': 'AVM',
      'gas_station': 'Benzinlik',
      'hospital': 'Hastane',
      'bank': 'Banka',
      'atm': 'ATM',
      'pharmacy': 'Eczane',
      'lodging': 'Konaklama',
      'food': 'Yemek',
      'establishment': 'İşletme',
      'point_of_interest': 'İlgi Noktası'
    };
    return translations[type] || type;
  };

  // POI seç/seçimi kaldır
  const togglePoiSelection = (poi: POI) => {
    setSelectedPois(prev => {
      const isSelected = prev.some(p => 
        (p.id && poi.id && p.id === poi.id) || 
        (p.name === poi.name && p.vicinity === poi.vicinity)
      );
      
      if (isSelected) {
        // POI'yi listeden çıkar
        return prev.filter(p => 
          !((p.id && poi.id && p.id === poi.id) || 
            (p.name === poi.name && p.vicinity === poi.vicinity))
        );
      } else {
        // POI'yi listeye ekle
        return [...prev, poi];
      }
    });
  };

  // POI seçili mi kontrol et
  const isPoiSelected = (poi: POI) => {
    const isSelected = selectedPois.some(p => 
      (p.id && poi.id && p.id === poi.id) || 
      (p.name === poi.name && p.vicinity === poi.vicinity)
    );
    return isSelected;
  };

  // En kısa rotayı hesapla
  const calculateOptimalRoute = async () => {
    if (!directionsService || !directionsRenderer || !currentLocation || selectedPois.length === 0) {
      toast.error('Rota oluşturmak için en az 1 POI seçin!');
      return;
    }

    setLoading(true);
    
    try {
      // Başlangıç noktası (mevcut konum)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const origin = new (window as any).google.maps.LatLng(currentLocation.lat, currentLocation.lng);
      
      // POI'lerin koordinatları
      const waypoints = selectedPois.map(poi => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        location: new (window as any).google.maps.LatLng(
          poi.geometry.location.lat(),
          poi.geometry.location.lng()
        ),
        stopover: true
      }));

      // Son POI'yi destination yap
      const destination = waypoints.pop()?.location || origin;

      const request = {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: true, // En kısa rota için optimize et
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        travelMode: (window as any).google.maps.TravelMode.WALKING,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unitSystem: (window as any).google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: true
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      directionsService.route(request, (result: any, status: any) => {
        setLoading(false);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (status === (window as any).google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.setDirections(result);

          // Rota bilgilerini hesapla
          const route = result.routes[0];
          let totalDistance = 0;
          let totalDuration = 0;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          route.legs.forEach((leg: any) => {
            totalDistance += leg.distance?.value || 0;
            totalDuration += leg.duration?.value || 0;
          });

          setRouteInfo({
            distance: `${(totalDistance / 1000).toFixed(1)} km`,
            duration: `${Math.round(totalDuration / 60)} dk`
          });

          toast.success(`Rota oluşturuldu! ${selectedPois.length} POI için en kısa yol hesaplandı.`);
        } else {
          console.error('Directions request failed:', status);
          toast.error('Rota hesaplanamadı. Lütfen farklı POIler seçin.');
        }
      });

    } catch (error) {
      console.error('Route calculation error:', error);
      toast.error('Rota hesaplama hatası');
      setLoading(false);
    }
  };

  // Rotayı temizle
  const clearRoute = () => {
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
      directionsRenderer.setMap(map);
    }
    setRouteInfo(null);
    setSelectedPois([]);
    toast.success('Rota ve seçimler temizlendi');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Harita & Rota Planlayıcı
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            İstediğiniz yerleri seçin ve size en optimal rotayı oluşturalım
          </p>
        </div>

        {/* Map Container */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-gray-200 dark:border-gray-700">
          {/* Map Controls */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={getCurrentLocation}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 font-medium"
            >
              <span>⌖</span>
              <span>Konumumu Bul</span>
            </button>
            
            <button
              onClick={fetchPOIs}
              disabled={loading || !map}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 font-medium disabled:bg-gray-400"
            >
              <span>●</span>
              <span>{loading ? 'Yükleniyor...' : 'Turistik Yerler'}</span>
            </button>
            
            <button
              onClick={() => fetchPOIsByType(['restaurant', 'cafe', 'food'])}
              disabled={loading || !map}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2 font-medium disabled:bg-gray-400"
            >
              <span>🍽</span>
              <span>{loading ? 'Yükleniyor...' : 'Restoranlar'}</span>
            </button>
            
            <button
              onClick={() => fetchPOIsByType(['lodging', 'hotel'])}
              disabled={loading || !map}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 font-medium disabled:bg-gray-400"
            >
              <span>�</span>
              <span>{loading ? 'Yükleniyor...' : 'Oteller'}</span>
            </button>
            
            {pois.length > 0 && (
              <button
                onClick={() => {
                  setPois([]);
                  // Seçili POI'leri KORUYORUZ - sadece haritadaki arama sonuçlarını temizliyoruz
                  // setSelectedPois([]); // Bu satırı kaldırdık
                  
                  // Sadece haritadaki marker'ları temizle
                  if (map) {
                    // Map'teki marker'ları temizlemek için marker tracking sistemi gerekli
                    // Şimdilik basit toast mesajı gösterelim
                  }
                  toast.success('POI arama sonuçları temizlendi!');
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 font-medium"
              >
                <span>✕</span>
                <span>Temizle</span>
              </button>
            )}
            
            {pois.length > 0 && (
              <div className="flex items-center">
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg font-medium">
                  {pois.length} yer bulundu
                </span>
              </div>
            )}
            
          </div>
          
          <div 
            ref={mapRef}
            className="w-full h-96 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden"
            style={{ minHeight: '400px' }}
          >
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">
                  Harita yükleniyor...
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Seçili POI'ler Paneli */}
        {selectedPois.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                ● Seçili Yerler ({selectedPois.length})
              </h2>
              <div className="flex space-x-3">
                <button
                  onClick={calculateOptimalRoute}
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center space-x-2 font-medium"
                >
                  <span>▲</span>
                  <span>{loading ? 'Hesaplanıyor...' : 'Rota Oluştur'}</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedPois([]);
                    clearRoute();
                  }}
                  className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Rota Bilgileri */}
            {routeInfo && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-6 border border-green-200 dark:border-green-700">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-3">
                  ✓ Rota Hesaplandı
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {routeInfo.distance}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Toplam Mesafe</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {routeInfo.duration}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Tahmini Süre</div>
                  </div>
                </div>
              </div>
            )}

            {/* Seçili POI'lerin Listesi */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedPois.map((poi, index) => {
                const uniqueKey = poi.id || `selected-${poi.name}-${poi.vicinity}-${index}`;
                return (
                  <div
                    key={uniqueKey}
                    className="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-5 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                  >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md">
                        {index + 1}
                      </div>
                      <h4 className="font-bold text-gray-800 dark:text-white text-base leading-tight">
                        {poi.name}
                      </h4>
                    </div>
                    <button
                      onClick={() => togglePoiSelection(poi)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all duration-200 text-lg group-hover:scale-110"
                      title="Seçimi kaldır"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-blue-500">●</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                      {poi.vicinity}
                    </p>
                  </div>
                  {poi.rating && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 bg-yellow-100 dark:bg-yellow-900/20 px-2 py-1 rounded-full">
                        <span className="text-yellow-500 text-sm">⭐</span>
                        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                          {poi.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* POI Listesi */}
        {pois.length > 0 && (
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-6 mb-8 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                <span className="text-2xl">●</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Yakındaki İlgi Çekici Yerler
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Ziyaret etmek istediğiniz yerleri seçin
                </p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pois.map((poi, index) => {
                const isSelected = isPoiSelected(poi);
                const uniqueKey = poi.id || `${poi.name}-${poi.vicinity}-${index}`;
                
                return (
                  <div
                    key={uniqueKey}
                    className={`group border-2 rounded-xl p-5 hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 ${
                      isSelected 
                        ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 shadow-lg scale-105' 
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-800'
                    }`}
                    onClick={() => togglePoiSelection(poi)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                          isSelected 
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-110' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30'
                        }`}>
                          {isSelected ? '✓' : index + 1}
                        </div>
                        <h3 className="font-bold text-gray-800 dark:text-white text-lg leading-tight">
                          {poi.name}
                        </h3>
                      </div>
                      {poi.rating && (
                        <div className="flex items-center space-x-1 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 px-3 py-2 rounded-full border border-yellow-200 dark:border-yellow-700 shadow-sm">
                          <span className="text-yellow-500 text-lg">⭐</span>
                          <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
                            {poi.rating.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-blue-500 text-lg">●</span>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">
                      {poi.vicinity}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {poi.types.slice(0, 3).map((type, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-800 dark:text-blue-400 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-700 font-medium"
                      >
                        {translateType(type)}
                      </span>
                    ))}
                  </div>
                  
                  {poi.price_level !== undefined && (
                    <div className="flex items-center space-x-3 mb-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Fiyat Seviyesi:</span>
                      <div className="flex">
                        {[...Array(5)].map((_, idx) => (
                          <span
                            key={idx}
                            className={`text-lg transition-all duration-200 ${
                              idx < poi.price_level! 
                                ? 'text-green-500 scale-110' 
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          >
                            💰
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg mb-4">
                    🌍 {poi.geometry.location.lat().toFixed(4)}, {poi.geometry.location.lng().toFixed(4)}
                  </div>
                  
                  {isSelected && (
                    <div className="text-center animate-pulse">
                      <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                        ✨ Rotaya Dahil ✨
                      </span>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="text-center mt-12">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
              Seyahat Planlama Araçları
            </h3>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/daily-planner"
                className="group bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">�</span>
                <span className="font-semibold text-lg">Günlük Planlayıcı</span>
              </a>
              <a
                href="/my-plans"
                className="group bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 flex items-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">📋</span>
                <span className="font-semibold text-lg">Planlarım</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
