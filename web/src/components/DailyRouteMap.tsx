"use client";

import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

interface Activity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cost: number;
  description?: string;
  category: string;
  location: string;
}

interface DailyRouteMapProps {
  activities: Activity[];
  city: string;
  onRouteCalculated?: (route: RouteInfo) => void;
}

interface RouteInfo {
  totalDistance: string;
  totalDuration: string;
  optimizedOrder: number[];
  waypoints: google.maps.LatLng[];
}

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

export default function DailyRouteMap({ activities, city, onRouteCalculated }: DailyRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Google Maps API yükle
  useEffect(() => {
    const initializeMap = () => {
      if (!mapRef.current) return;

      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 13,
        center: { lat: 39.9334, lng: 32.8597 }, // Ankara default
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          }
        ]
      });

      const directionsServiceInstance = new google.maps.DirectionsService();
      const directionsRendererInstance = new google.maps.DirectionsRenderer({
        draggable: true,
        panel: undefined,
        polylineOptions: {
          strokeColor: '#4285F4',
          strokeWeight: 5,
          strokeOpacity: 0.8
        },
        markerOptions: {
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#4285F4" stroke="white" stroke-width="2"/>
                <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">•</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12)
          }
        }
      });

      directionsRendererInstance.setMap(mapInstance);

      setMap(mapInstance);
      setDirectionsService(directionsServiceInstance);
      setDirectionsRenderer(directionsRendererInstance);

      // Şehir merkezini bul ve haritayı oraya odakla
      if (city) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: city }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            mapInstance.setCenter(results[0].geometry.location);
          }
        });
      }
    };

    const loadGoogleMaps = () => {
      if (window.google) {
        initializeMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,geometry&callback=initMap`;
      script.async = true;
      script.defer = true;
      
      window.initMap = initializeMap;
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [city]);

  // Aktivitelerin koordinatlarını al
  const geocodeActivities = async (activities: Activity[]): Promise<google.maps.LatLng[]> => {
    const geocoder = new google.maps.Geocoder();
    const locations: google.maps.LatLng[] = [];

    for (const activity of activities) {
      try {
        const address = `${activity.location}, ${city}`;
        const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results) {
              resolve(results);
            } else {
              reject(new Error(`Geocoding failed for ${address}: ${status}`));
            }
          });
        });

        if (result[0]) {
          locations.push(result[0].geometry.location);
        }
      } catch (error) {
        console.error(`Error geocoding ${activity.location}:`, error);
        toast.error(`"${activity.location}" adresi bulunamadı`);
      }
    }

    return locations;
  };

  // En kısa rotayı hesapla
  const calculateOptimalRoute = async () => {
    if (!directionsService || !map || activities.length < 2) {
      toast.error('En az 2 aktivite gerekli');
      return;
    }

    setIsLoading(true);
    
    try {
      // Aktivitelerin koordinatlarını al
      const locations = await geocodeActivities(activities);
      
      if (locations.length < 2) {
        toast.error('En az 2 geçerli adres bulunamadı');
        return;
      }

      // İlk aktiviteyi başlangıç, son aktiviteyi bitiş noktası yap
      const origin = locations[0];
      const destination = locations[locations.length - 1];
      const waypoints = locations.slice(1, -1).map(location => ({
        location,
        stopover: true
      }));

      // Directions API'ye istek gönder
      const request: google.maps.DirectionsRequest = {
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true, // En kısa rota için optimize et
        travelMode: google.maps.TravelMode.WALKING, // Yaya rotası
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: true
      };

      directionsService.route(request, (result, status) => {
        if (status === 'OK' && result) {
          directionsRenderer?.setDirections(result);

          // Rota bilgilerini hesapla
          const route = result.routes[0];
          let totalDistance = 0;
          let totalDuration = 0;

          route.legs.forEach(leg => {
            totalDistance += leg.distance?.value || 0;
            totalDuration += leg.duration?.value || 0;
          });

          const routeInfo: RouteInfo = {
            totalDistance: `${(totalDistance / 1000).toFixed(1)} km`,
            totalDuration: `${Math.round(totalDuration / 60)} dk`,
            optimizedOrder: result.routes[0].waypoint_order || [],
            waypoints: locations
          };

          setRouteInfo(routeInfo);
          onRouteCalculated?.(routeInfo);

          toast.success('Rota başarıyla hesaplandı!');
        } else {
          console.error('Directions request failed:', status);
          toast.error('Rota hesaplanamadı');
        }
      });

    } catch (error) {
      console.error('Route calculation error:', error);
      toast.error('Rota hesaplama hatası');
    } finally {
      setIsLoading(false);
    }
  };

  // Haritayı temizle
  const clearRoute = () => {
    directionsRenderer?.setMap(null);
    directionsRenderer?.setMap(map);
    setRouteInfo(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {/* Kontroller */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            📍 Günlük Rota Planlayıcı
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={calculateOptimalRoute}
              disabled={isLoading || activities.length < 2}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Hesaplanıyor...</span>
                </>
              ) : (
                <>
                  <span>🗺️</span>
                  <span>Rota Oluştur</span>
                </>
              )}
            </button>
            <button
              onClick={clearRoute}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              Temizle
            </button>
          </div>
        </div>

        {/* Rota Bilgileri */}
        {routeInfo && (
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Toplam Mesafe:</span>
                <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                  {routeInfo.totalDistance}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Tahmini Süre:</span>
                <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                  {routeInfo.totalDuration}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Aktivite Listesi */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Aktiviteler ({activities.length})
          </h4>
          <div className="space-y-1">
            {activities.map((activity, index) => (
              <div key={activity.id} className="flex items-center space-x-2 text-sm">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                  {index + 1}
                </span>
                <span className="text-gray-600 dark:text-gray-400">{activity.startTime}</span>
                <span className="font-medium text-gray-800 dark:text-white">{activity.name}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">📍 {activity.location}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Harita */}
      <div
        ref={mapRef}
        className="w-full h-96"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
