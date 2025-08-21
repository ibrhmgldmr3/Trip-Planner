"use client";

import { useState, useEffect, useCallback } from "react";

// POI tipi
export interface POI {
  id: string;
  name: string;
  address?: string;
  location: {
    lat: number;
    lng: number;
  };
  rating?: number;
  types?: string[];
  photos?: {
    reference: string;
    width: number;
    height: number;
  }[];
  distance?: number;
  duration?: number;
}

// POI'leri getiren hook
export function usePOIs(city?: string, lat?: number, lon?: number, options?: {
  radius?: number;
  kinds?: string;
  provider?: 'google' | 'opentripmap';
  type?: string;
  limit?: number;
}) {
  // State'ler
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Varsayılan options
  const defaultOptions = {
    radius: 3000,
    kinds: "interesting_places,historic,foods",
    provider: "opentripmap" as const,
    type: "tourist_attraction",
    limit: 5
  };

  // Options'ları birleştir
  const mergedOptions = { ...defaultOptions, ...options };

  // POI'leri getiren fonksiyon
  const fetchPOIs = useCallback(async () => {
    if ((!city && (!lat || !lon)) || loading) return;

    setLoading(true);
    setError(null);
    
    try {
      let url = "/api/poi?";
      
      // Google provider için
      if (mergedOptions.provider === "google" && city) {
        url += `city=${encodeURIComponent(city)}&provider=google&type=${encodeURIComponent(mergedOptions.type)}&limit=${mergedOptions.limit}`;
      } 
      // OpenTripMap provider için
      else if (lat && lon) {
        url += `lat=${lat}&lon=${lon}&radius=${mergedOptions.radius}&kinds=${encodeURIComponent(mergedOptions.kinds)}`;
      } else {
        throw new Error("Google provider için şehir veya OpenTripMap için lat/lon gereklidir");
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "POI'ler getirilirken bir hata oluştu");
      }
      
      const data = await response.json();
      
      if (mergedOptions.provider === "google") {
        setPois(data.pois);
      } else {
        // OpenTripMap verilerini dönüştür
        const openTripMapPOIs = data.pois.map((poi: any) => ({
          id: poi.id || poi.properties.xid,
          name: poi.properties.name || "İsimsiz Mekan",
          location: {
            lat: poi.geometry.coordinates[1],
            lng: poi.geometry.coordinates[0],
          },
          types: [poi.properties.kinds],
        }));
        setPois(openTripMapPOIs);
      }
    } catch (err) {
      console.error("POI getirme hatası:", err);
      setError(err instanceof Error ? err.message : "POI'ler getirilirken bilinmeyen bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [city, lat, lon, mergedOptions, loading]);

  // Component mount olduğunda veya parametreler değiştiğinde POI'leri getir
  useEffect(() => {
    fetchPOIs();
  }, [fetchPOIs]);

  // Yeniden POI'leri getiren fonksiyon
  const refetch = useCallback(() => {
    fetchPOIs();
  }, [fetchPOIs]);

  return { pois, loading, error, refetch };
}

// Rota hesaplayan hook
export function useRoute(
  waypoints: { lat: number; lng: number }[],
  options?: {
    profile?: string;
    provider?: 'openrouteservice' | 'google';
  }
) {
  // State'ler
  const [route, setRoute] = useState<{
    geometry: any;
    distance: number;
    duration: number;
    provider?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Varsayılan options
  const defaultOptions = {
    profile: "foot-walking",
    provider: "openrouteservice" as const
  };

  // Options'ları birleştir
  const mergedOptions = { ...defaultOptions, ...options };

  // Rota hesaplayan fonksiyon
  const calculateRoute = useCallback(async () => {
    if (waypoints.length < 2 || loading) return;

    setLoading(true);
    setError(null);
    
    try {
      const coords = waypoints.map(point => [point.lng, point.lat]);
      
      const response = await fetch("/api/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coords,
          profile: mergedOptions.profile,
          options: {
            provider: mergedOptions.provider
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Rota hesaplanırken bir hata oluştu");
      }
      
      const data = await response.json();
      setRoute({
        geometry: data.geometry,
        distance: data.distance || data.summary?.distance || 0,
        duration: data.duration || data.summary?.duration || 0,
        provider: data.provider
      });
    } catch (err) {
      console.error("Rota hesaplama hatası:", err);
      setError(err instanceof Error ? err.message : "Rota hesaplanırken bilinmeyen bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [waypoints, mergedOptions, loading]);

  // Component mount olduğunda veya parametreler değiştiğinde rotayı hesapla
  useEffect(() => {
    calculateRoute();
  }, [calculateRoute]);

  // Yeniden rota hesaplayan fonksiyon
  const recalculate = useCallback(() => {
    calculateRoute();
  }, [calculateRoute]);

  return { route, loading, error, recalculate };
}

// Mesafe matrisi hesaplayan hook
export function useDistanceMatrix(
  origins: { lat: number; lng: number }[],
  destinations: { lat: number; lng: number }[],
  options?: {
    profile?: string;
    metrics?: string[];
    provider?: 'openrouteservice' | 'google';
  }
) {
  // State'ler
  const [matrix, setMatrix] = useState<{
    durations: number[][] | null;
    distances: number[][] | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Varsayılan options
  const defaultOptions = {
    profile: "foot-walking",
    metrics: ["duration", "distance"],
    provider: "openrouteservice" as const
  };

  // Options'ları birleştir
  const mergedOptions = { ...defaultOptions, ...options };

  // Hesaplama fonksiyonu
  const calculateMatrix = useCallback(async () => {
    if (origins.length === 0 || destinations.length === 0 || loading) return;

    setLoading(true);
    setError(null);
    
    try {
      // Google için farklı bir API çağrısı kullanılır, bu örnekte basitleştirilmiş
      if (mergedOptions.provider === "google") {
        // Google için dönüştürme gerekmiyor, direkt olarak kullanıyoruz
        const response = await fetch("/api/matrix", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            // Koordinatlar [lng, lat] formatından [lat, lng] formatına dönüştürülüyor
            coords: [...origins, ...destinations].map(point => [point.lng, point.lat]),
            profile: mergedOptions.profile,
            metrics: mergedOptions.metrics,
            provider: "google"
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Mesafe matrisi hesaplanırken bir hata oluştu");
        }
        
        const data = await response.json();
        setMatrix({
          durations: data.durations,
          distances: data.distances
        });
      } else {
        // OpenRouteService için
        // Tüm noktaları tek bir dizi olarak gönder (koordinatları [lng, lat] formatında)
        const allPoints = [...origins, ...destinations].map(point => [point.lng, point.lat]);
        
        const response = await fetch("/api/matrix", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            coords: allPoints,
            profile: mergedOptions.profile,
            metrics: mergedOptions.metrics
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Mesafe matrisi hesaplanırken bir hata oluştu");
        }
        
        const data = await response.json();
        
        // Burada origins x destinations matrisini oluşturmak için
        // tam matris verilerini kullanmalıyız (OpenRouteService tüm noktalar arası mesafeleri verir)
        // Bu örnek basitleştirilmiştir
        setMatrix({
          durations: data.durations,
          distances: data.distances
        });
      }
    } catch (err) {
      console.error("Mesafe matrisi hesaplama hatası:", err);
      setError(err instanceof Error ? err.message : "Mesafe matrisi hesaplanırken bilinmeyen bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [origins, destinations, mergedOptions, loading]);

  // Component mount olduğunda veya parametreler değiştiğinde hesapla
  useEffect(() => {
    calculateMatrix();
  }, [calculateMatrix]);

  // Yeniden hesaplayan fonksiyon
  const recalculate = useCallback(() => {
    calculateMatrix();
  }, [calculateMatrix]);

  return { matrix, loading, error, recalculate };
}
