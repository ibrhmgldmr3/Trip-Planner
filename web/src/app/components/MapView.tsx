"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import { nearestNeighborOrder } from "@/lib/nearest";
import RouteStats from "./RouteStats";
import CategoryIcon from "./CategoryIcon";

// Types
interface Poi {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category?: string;
  kinds?: string;
}

interface RouteGeometry {
  type: string;
  coordinates: number[][];
}

interface RouteResponse {
  geometry: RouteGeometry | null;
  distance?: number;
  duration?: number;
  summary?: {
    distance: number;
    duration: number;
  };
}

interface MatrixResponse {
  durations: number[][];
  distances?: number[][];
}

// Constants
const DEFAULT_CENTER: [number, number] = [41.0082, 28.9784]; // Istanbul
const DEFAULT_ZOOM = 14;
const MAX_POIS = 10;
const DEFAULT_RADIUS = 3000;

// Custom icons with better styling
const createIcon = (color: string, isSelected = false) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${isSelected ? '20px' : '16px'};
        height: ${isSelected ? '20px' : '16px'};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: ${isSelected ? '12px' : '10px'};
        font-weight: bold;
      ">
        ${isSelected ? '★' : '●'}
      </div>
    `,
    iconSize: [isSelected ? 24 : 20, isSelected ? 24 : 20],
    iconAnchor: [isSelected ? 12 : 10, isSelected ? 12 : 10],
  });
};

const centerIcon = createIcon('#ef4444', true); // Red for center
const poiIcon = createIcon('#3b82f6'); // Blue for POIs
const selectedPoiIcon = createIcon('#10b981', true); // Green for selected POIs

// Map click handler component
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Fit bounds component with better error handling and performance
function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (!points.length) return;
    
    try {
      const validPoints = points.filter(([lat, lng]) => 
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      );
      
      if (validPoints.length === 0) return;
      
      if (validPoints.length === 1) {
        map.setView(validPoints[0], DEFAULT_ZOOM);
        return;
      }
      
      const bounds = L.latLngBounds(validPoints);
      map.fitBounds(bounds.pad(0.1), { maxZoom: 16 });
    } catch (error) {
      console.warn('Error fitting bounds:', error);
    }
  }, [points, map]);
  
  return null;
}

// Loading indicator component
function LoadingIndicator({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;
  
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white bg-opacity-95 rounded-lg p-3 shadow-lg border">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-medium text-gray-700">Yükleniyor...</span>
      </div>
    </div>
  );
}

// Main MapView component
export default function MapView() {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [pois, setPois] = useState<Poi[]>([]);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [selectedPois, setSelectedPois] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  
  const mapRef = useRef<L.Map | null>(null);

  // Memoized filtered POIs for performance
  const filteredPois = useMemo(() => {
    return pois.filter(poi => 
      Number.isFinite(poi.lat) && Number.isFinite(poi.lon) &&
      poi.lat >= -90 && poi.lat <= 90 && 
      poi.lon >= -180 && poi.lon <= 180
    );
  }, [pois]);

  // Fetch POIs with better error handling
  const fetchPois = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = `/api/pois-overpass?lat=${center[0]}&lon=${center[1]}&radius=${radius}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const { pois: rawPois = [] } = data;
      
      const mappedPois: Poi[] = rawPois
        .map((f: { id?: string; name?: string; lat?: number; lon?: number; category?: string; kind?: string }) => ({
          id: f?.id ?? crypto.randomUUID(),
          name: f?.name || "POI",
          lat: f?.lat,
          lon: f?.lon,
          category: f?.category || 'unknown',
          kinds: f?.kind || '',
        }))
        .filter((p: Poi) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
        .slice(0, MAX_POIS);
      
      setPois(mappedPois);
      setSelectedPois(new Set());
      setRouteLine([]);
      setRouteInfo(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'POI getirme işlemi başarısız';
      setError(errorMessage);
      console.error('POI fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [center, radius]);

  // Build route with better error handling and user feedback
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
      // Prepare coordinates for matrix API (lng, lat format)
      const coords = activePois.map((p) => [p.lon, p.lat]);

      // Get duration matrix
      const matrixResponse = await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coords, profile: "foot-walking" }),
      });

      if (!matrixResponse.ok) {
        throw new Error(`Matrix API error: ${matrixResponse.status}`);
      }

      const matrixData: MatrixResponse = await matrixResponse.json();
      
      if (!matrixData.durations) {
        throw new Error('Duration matrix bulunamadı');
      }

      // Calculate optimal order using nearest neighbor
      const order = nearestNeighborOrder(matrixData.durations, 0);
      const orderedCoords = order.map((idx) => coords[idx]);

      // Get route geometry
      const routeResponse = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          coords: orderedCoords, 
          profile: "foot-walking",
          options: {
            instructions: false,
            geometry_simplify: false
          }
        }),
      });

      if (!routeResponse.ok) {
        throw new Error(`Route API error: ${routeResponse.status}`);
      }

      const routeData: RouteResponse = await routeResponse.json();
      
      if (!routeData.geometry) {
        throw new Error('Rota geometrisi bulunamadı');
      }

      // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
      const routeCoordinates = routeData.geometry.coordinates.map(
        ([lng, lat]: number[]) => [lat, lng] as [number, number]
      );
      
      setRouteLine(routeCoordinates);
      
      // Set route info if available
      if (routeData.summary || (routeData.distance && routeData.duration)) {
        setRouteInfo({
          distance: routeData.summary?.distance ?? routeData.distance ?? 0,
          duration: routeData.summary?.duration ?? routeData.duration ?? 0,
        });
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Rota oluşturma başarısız';
      setError(errorMessage);
      console.error('Route building error:', err);
    } finally {
      setLoading(false);
    }
  }, [filteredPois, selectedPois]);

  // Handle map click
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setCenter([lat, lng]);
    setError(null);
  }, []);

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

  // Clear route
  const clearRoute = useCallback(() => {
    setRouteLine([]);
    setRouteInfo(null);
    setSelectedPois(new Set());
  }, []);

  // All points for fitting bounds
  const allPoints = useMemo(() => {
    const points: [number, number][] = [center];
    points.push(...filteredPois.map(p => [p.lat, p.lon] as [number, number]));
    return points;
  }, [center, filteredPois]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white p-5 rounded-xl shadow-md border border-blue-100">
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <button 
            onClick={fetchPois} 
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors hover-lift"
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
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors hover-lift"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Rota Oluştur
          </button>
          
          <button 
            onClick={clearRoute}
            disabled={routeLine.length === 0}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors hover-lift"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Temizle
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <label htmlFor="radius" className="text-sm font-medium text-gray-700">Yarıçap:</label>
            <select 
              id="radius"
              value={radius} 
              onChange={(e) => setRadius(Number(e.target.value))}
              className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
            >
              <option value={1000}>1 km</option>
              <option value={3000}>3 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
            </select>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-600">
          <span className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Merkez: {center[0].toFixed(4)}, {center[1].toFixed(4)}
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
            routeComplete={routeLine.length > 0}
          />
        )}

        {/* Error message */}
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>{error}</div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden shadow-lg">
        <MapContainer 
          center={center} 
          zoom={DEFAULT_ZOOM} 
          style={{ height: "70vh", width: "100%" }}
          ref={mapRef}
          className="z-10"
        >
          <TileLayer 
            url={process.env.NEXT_PUBLIC_MAP_TILES || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* Center marker */}
          <Marker position={center} icon={centerIcon}>
            <Popup>
              <div className="min-w-[150px]">
                <div className="font-semibold mb-1 text-center">Merkez Nokta</div>
                <div className="flex justify-center mb-1">
                  <div className="text-center text-xs bg-red-100 text-red-800 rounded-full px-2 py-0.5">
                    Arama Merkezi
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-center mb-2">
                  {center[0].toFixed(5)}, {center[1].toFixed(5)}
                </div>
                <div className="text-xs text-gray-600 text-center">
                  {radius / 1000} km yarıçaplı alanda arama yapılıyor
                </div>
              </div>
            </Popup>
          </Marker>
          
          {/* POI markers */}
          {filteredPois.map(poi => (
            <Marker 
              key={poi.id} 
              position={[poi.lat, poi.lon]} 
              icon={selectedPois.has(poi.id) ? selectedPoiIcon : poiIcon}
              eventHandlers={{
                click: () => togglePoiSelection(poi.id)
              }}
            >
              <Popup>
                <div className="min-w-[150px]">
                  <div className="font-semibold mb-1">{poi.name}</div>
                  {poi.category && (
                    <div className="flex items-center gap-1 mb-1">
                      <CategoryIcon category={poi.category} size={16} />
                      <div className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full inline-block">
                        {poi.category}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mb-2">
                    {poi.lat.toFixed(4)}, {poi.lon.toFixed(4)}
                  </div>
                  <button 
                    onClick={() => togglePoiSelection(poi.id)}
                    className={`text-xs py-1 px-2 rounded-md w-full ${
                      selectedPois.has(poi.id) 
                        ? 'bg-red-500 text-white' 
                        : 'bg-green-500 text-white'
                    }`}
                  >
                    {selectedPois.has(poi.id) ? 'Rotadan Çıkar' : 'Rotaya Ekle'}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Route line with improved animation */}
          {routeLine.length > 1 && (
            <>
              {/* Ana rota çizgisi - alt katman */}
              <Polyline 
                positions={routeLine} 
                pathOptions={{
                  color: "#3b82f6", // Mavi alt çizgi
                  weight: 7,
                  opacity: 0.4,
                  lineJoin: "round",
                  lineCap: "round",
                }}
              />
              
              {/* Animasyonlu çizgi - üst katman */}
              <Polyline 
                positions={routeLine} 
                pathOptions={{
                  color: "#ef4444", // Kırmızı animasyonlu çizgi
                  weight: 4,
                  opacity: 0.8,
                  lineJoin: "round",
                  lineCap: "round",
                  dashArray: "10, 15",
                  className: "route-dash-animation"
                }}
              />
              
              {/* Başlangıç ve bitiş noktaları için özel marker */}
              {routeLine.length > 1 && (
                <>
                  <Marker 
                    position={routeLine[0]} 
                    icon={L.divIcon({
                      className: 'custom-route-marker',
                      html: `<div class="start-marker"><div style="width: 16px; height: 16px; border-radius: 50%; background-color: #10b981; border: 3px solid white; box-shadow: 0 0 10px rgba(16, 185, 129, 0.7);"></div></div>`,
                      iconSize: [16, 16],
                      iconAnchor: [8, 8],
                    })}
                  >
                    <Popup>
                      <div className="font-semibold text-green-600">Başlangıç Noktası</div>
                    </Popup>
                  </Marker>
                  
                  <Marker 
                    position={routeLine[routeLine.length - 1]} 
                    icon={L.divIcon({
                      className: 'custom-route-marker',
                      html: `<div class="end-marker"><div style="width: 16px; height: 16px; border-radius: 50%; background-color: #ef4444; border: 3px solid white; box-shadow: 0 0 10px rgba(239, 68, 68, 0.7);"></div></div>`,
                      iconSize: [16, 16],
                      iconAnchor: [8, 8],
                    })}
                  >
                    <Popup>
                      <div className="font-semibold text-red-600">Bitiş Noktası</div>
                    </Popup>
                  </Marker>
                </>
              )}
            </>
          )}
          
          {/* Event handlers */}
          <MapClickHandler onMapClick={handleMapClick} />
          <FitToMarkers points={allPoints} />
        </MapContainer>
        
        {/* Loading overlay */}
        <LoadingIndicator isVisible={loading} />
      </div>
    </div>
  );
}
    