"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePOIs, useRoute } from "@/hooks/useMapServices";
import GoogleMapComponent from "./maps/GoogleMapComponent";
import PlacesAutocomplete from "./maps/PlacesAutocomplete";
import RouteStats from "@/app/components/RouteStats";
import { useJsApiLoader } from "@react-google-maps/api";

// Constants
const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 }; // Istanbul
const DEFAULT_ZOOM = 14;
const MAX_POIS = 10;
const DEFAULT_RADIUS = 3000;
const LIBRARIES = ["places", "geometry"];

// Helper to get marker color by type
const getMarkerColorByType = (types: string[] = []): string => {
  if (types.some(t => t.includes("historic") || t.includes("landmark"))) return "#ef4444"; // Red for historic
  if (types.some(t => t.includes("museum"))) return "#f59e0b"; // Amber for museums
  if (types.some(t => t.includes("food") || t.includes("restaurant"))) return "#10b981"; // Green for food
  if (types.some(t => t.includes("park") || t.includes("natural"))) return "#16a34a"; // Green for parks
  if (types.some(t => t.includes("shop") || t.includes("store"))) return "#6366f1"; // Indigo for shopping
  return "#3b82f6"; // Blue default
};

// Custom marker SVG
const createSvgMarkerIcon = (color: string, number?: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
      ${number !== undefined ? `<text x="12" y="11" text-anchor="middle" font-size="8" font-weight="bold" fill="${color}">${number}</text>` : ''}
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

// Main MapView component
export default function MapView() {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [selectedPois, setSelectedPois] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [routePath, setRoutePath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Load Google Maps API
  const { isLoaded: isGoogleMapsLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES as ["places", "geometry"],
  });

  // Use our custom hooks for POIs
  const {
    pois: fetchedPois,
    loading: poisLoading,
    error: poisError,
    refetch: refetchPois,
    clearPois
  } = usePOIs(
    undefined, // City is not used when providing lat/lng
    center.lat,
    center.lng,
    {
      radius,
      limit: MAX_POIS
    }
  );

  // İsteğin otomatik gönderilmesini engelle
  useEffect(() => {
    // İlk açılışta otomatik olarak çağrılmasın
    // POI'ler kullanıcı butona tıkladığında getirilecek
  }, [center]);

  // Filtered POIs
  const filteredPois = useMemo(() => {
    return (fetchedPois || []).slice(0, MAX_POIS);
  }, [fetchedPois]);

  // Get selected POIs array
  const selectedPoisArray = useMemo(() => {
    return filteredPois.filter(poi => selectedPois.has(poi.id));
  }, [filteredPois, selectedPois]);

  // Setup route calculation
  const {
    route,
    loading: routeLoading,
    error: routeError,
    recalculate: recalculateRoute
  } = useRoute(
    selectedPoisArray.length > 0 
      ? selectedPoisArray.map(p => p.location)
      : [],
    {
      profile: "foot-walking"
    }
  );

  // Update loading and error states
  useEffect(() => {
    setLoading(poisLoading || routeLoading);
    setError(poisError || routeError || null);
  }, [poisLoading, routeLoading, poisError, routeError]);

  // Update route info when route changes
  useEffect(() => {
    if (route && route.geometry) {

      // Convert GeoJSON coordinates to Google LatLngLiteral[]
      const path = route.geometry.coordinates.map(
        ([lng, lat]: number[]) => ({ lat, lng })
      );
      
      setRoutePath(path);
      setRouteInfo({
        distance: route.distance,
        duration: route.duration
      });
    } else {
      setRoutePath([]);
      setRouteInfo(null);
    }
  }, [route]);

  // Handle map click
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newCenter = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng()
      };
      setCenter(newCenter);
      setError(null);
    }
  }, []);

  // Kullanıcının konumunu al
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Tarayıcınız konum hizmetlerini desteklemiyor.");
      return;
    }

    setIsLoadingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCenter(userLocation);
        setIsLoadingLocation(false);
      },
      (err) => {
        console.error("Konum alınamadı:", err);
        let errorMessage = "Konum alınamadı.";
        
        switch(err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = "Konum izni reddedildi. Lütfen konum erişimine izin verin.";
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = "Konum bilgisi kullanılamıyor.";
            break;
          case err.TIMEOUT:
            errorMessage = "Konum isteği zaman aşımına uğradı.";
            break;
        }
        
        setError(errorMessage);
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, []);

  // Harita yüklendiğinde kullanıcının konumunu al
  useEffect(() => {
    if (isGoogleMapsLoaded) {
      getUserLocation();
    }
  }, [isGoogleMapsLoaded, getUserLocation]);

  // Fetch POIs manually
  const fetchPois = useCallback(() => {
    refetchPois();
  }, [refetchPois]);

  // Toggle POI selection
  const togglePoiSelection = useCallback((poiId: string) => {
    setSelectedPois(prev => {
      const newSet = new Set(prev);
      if (newSet.has(poiId)) {
        newSet.delete(poiId);
      } else {
        newSet.add(poiId);
      }
      return newSet;
    });
  }, []);

  // Build route with optimal order
  const buildRoute = useCallback(async () => {
    const activePois = selectedPois.size > 0 
      ? filteredPois.filter(p => selectedPois.has(p.id))
      : filteredPois;
      
    if (activePois.length < 2) {
      setError('Rota oluşturmak için en az 2 POI seçin');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create waypoints from selected POIs
      if (selectedPois.size > 0) {
        // Recalculate route with selected POIs
        recalculateRoute();
      } else {
        // If no POIs are selected, select all and calculate route
        const newSelected = new Set(filteredPois.map(p => p.id));
        setSelectedPois(newSelected);
        // The route will be recalculated automatically when selectedPois changes
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Rota oluşturma başarısız';
      setError(errorMessage);
      console.error('Route building error:', err);
    } finally {
      setLoading(false);
    }
  }, [filteredPois, selectedPois, recalculateRoute]);

  // Clear route
  const clearRoute = useCallback(() => {
    setRoutePath([]);
    setRouteInfo(null);
    setSelectedPois(new Set());
    clearPois(); // POI'leri de temizle
    
    // Haritayı kullanıcının mevcut konumuna geri al
    // Eğer konum izni yoksa, varsayılan merkeze git
    getUserLocation();
  }, [clearPois, getUserLocation]);

  // Handle place selection from autocomplete
  const handlePlaceSelect = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const newCenter = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };
      setCenter(newCenter);
      setError(null);
    }
  }, []);

  // Prepare markers for Google Map
  const mapMarkers = useMemo(() => {
    const markers = [];
    
    // Center marker
    markers.push({
      id: 'center',
      position: center,
      title: 'Merkez Nokta',
      icon: createSvgMarkerIcon('#ef4444'),
      draggable: false,
      onClick: () => {} // No action for center marker
    });
    
    // POI markers
    filteredPois.forEach((poi, index) => {
      const isSelected = selectedPois.has(poi.id);
      const color = getMarkerColorByType(poi.types);
      
      markers.push({
        id: poi.id,
        position: poi.location,
        title: poi.name,
        icon: createSvgMarkerIcon(color, isSelected ? index + 1 : undefined),
        draggable: false,
        onClick: () => togglePoiSelection(poi.id)
      });
    });
    
    return markers;
  }, [center, filteredPois, selectedPois, togglePoiSelection]);

  // Prepare polylines for Google Map
  const mapPolylines = useMemo(() => {
    if (routePath.length === 0) return [];
    
    const polylines = [];
    
    polylines.push({
      id: 'route',
      path: routePath,
      options: {
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 6
      }
    });
    
    // Add animated dashed line on top
    polylines.push({
      id: 'route-dashed',
      path: routePath,
      options: {
        strokeColor: '#ef4444',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        icons: [
          {
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 1,
              scale: 4,
            },
            offset: '0',
            repeat: '20px'
          }
        ]
      }
    });
    
    return polylines;
  }, [routePath]);

  // Map options
  const mapOptions = {
    streetViewControl: false,
    mapTypeControl: true,
    fullscreenControl: true,
    zoomControl: true,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  };

  // Handle Google Maps API loading error
  useEffect(() => {
    if (loadError) {
      setError(`Google Maps API yüklenirken hata oluştu: ${loadError.message}`);
    }
  }, [loadError]);

  // Loading indicator while Google Maps API is loading
  if (!isGoogleMapsLoaded) {
    return (
      <div className="flex items-center justify-center h-[70vh] bg-gray-100 dark:bg-gray-800 rounded-xl">
        <div className="text-center p-5">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Google Maps API yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border border-blue-100 dark:border-blue-900">
        <div className="flex flex-wrap gap-3 items-center mb-3">
          {/* Search location input */}
          <div className="w-full md:w-64 mb-3 md:mb-0">
            <PlacesAutocomplete 
              onPlaceSelect={handlePlaceSelect}
              placeholder="Konum ara..."
              className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
              isLoaded={isGoogleMapsLoaded}
              showLocationButton={true}
            />
          </div>
          
          <button 
            onClick={fetchPois} 
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors hover-lift disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Yükleniyor...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                POI Getir
              </>
            )}
          </button>
          
          <button 
            onClick={buildRoute} 
            disabled={loading || filteredPois.length < 2}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors hover-lift disabled:opacity-50 disabled:pointer-events-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Rota Oluştur
          </button>
          
          <button 
            onClick={clearRoute}
            disabled={routePath.length === 0 && filteredPois.length === 0}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors hover-lift disabled:opacity-50 disabled:pointer-events-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Temizle
          </button>

          {/* Map radius setting */}
          <div className="flex items-center gap-2">
            <label htmlFor="radius" className="text-sm font-medium text-gray-700 dark:text-gray-300">Yarıçap:</label>
            <select 
              id="radius"
              value={radius} 
              onChange={(e) => setRadius(Number(e.target.value))}
              className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
            >
              <option value={1000}>1 km</option>
              <option value={3000}>3 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
            </select>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-600 dark:text-gray-300">
          <span className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Merkez: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
          </span>
          <span className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            POI: {filteredPois.length}
          </span>
          {selectedPois.size > 0 && 
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Seçili: {selectedPois.size}
            </span>
          }
        </div>

        {/* Route Stats */}
        {routeInfo && (
          <RouteStats 
            distance={routeInfo.distance} 
            duration={routeInfo.duration}
            routeComplete={routePath.length > 0}
          />
        )}

        {/* Error message */}
        {error && (
          <div className="mt-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-3 text-sm flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>{error}</div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ height: "70vh" }}>
        <GoogleMapComponent
          center={center}
          zoom={DEFAULT_ZOOM}
          markers={mapMarkers}
          polylines={mapPolylines}
          onMapClick={handleMapClick}
          mapOptions={mapOptions}
          isLoaded={isGoogleMapsLoaded}
        />
        
        {/* Loading overlay */}
        {loading && (
          <div className="absolute top-4 right-4 z-[1000] bg-white dark:bg-gray-800 bg-opacity-95 rounded-lg p-3 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Yükleniyor...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
