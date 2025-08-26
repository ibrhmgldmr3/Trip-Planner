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
  type?: string;
  limit?: number;
}) {
  // State'ler
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // POI'leri getiren fonksiyon
  const fetchPOIs = useCallback(async () => {
    if ((!city && !lat && !lon) || loading) return;

    setLoading(true);
    setError(null);
    
    // Varsayılan options
    const defaultOptions = {
      type: "tourist_attraction",
      limit: 5
    };
    
    // Options'ları birleştir
    const mergedOptions = { 
      ...defaultOptions, 
      ...options 
    };
    
    try {
      let url;
      if (city) {
        url = `/api/poi?city=${encodeURIComponent(city)}&type=${encodeURIComponent(mergedOptions.type)}&limit=${mergedOptions.limit}`;
      } else if (lat !== undefined && lon !== undefined) {
        url = `/api/poi?lat=${lat}&lon=${lon}&radius=${mergedOptions.radius || 3000}&type=${encodeURIComponent(mergedOptions.type)}&limit=${mergedOptions.limit}`;
      } else {
        throw new Error("Şehir adı veya koordinat gereklidir");
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        let errorMsg = "POI'ler getirilirken bir hata oluştu";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (error) {
          // Error data could not be parsed as JSON
          errorMsg = `${response.status} - ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      setPois(data.pois);
    } catch (err) {
      console.error("POI getirme hatası:", err);
      setError(err instanceof Error ? err.message : "POI'ler getirilirken bilinmeyen bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [city, lat, lon, options, loading]);

  // Component mount olduğunda veya parametreler değiştiğinde POI'leri getir
  useEffect(() => {
    // Otomatik olarak istek gönderme
    // fetchPOIs(); 
  }, [fetchPOIs, lat, lon]);

  // Yeniden POI'leri getiren fonksiyon
  const refetch = useCallback(() => {
    fetchPOIs();
  }, [fetchPOIs]);

  // POI'leri temizleyen fonksiyon
  const clearPois = useCallback(() => {
    setPois([]);
  }, []);

  return { pois, loading, error, refetch, clearPois };
}

// Rota geometry tipi
interface RouteGeometry {
  type: string;
  coordinates: [number, number][] | number[][];
}

// Rota hesaplayan hook
export function useRoute(
  waypoints: { lat: number; lng: number }[],
  options?: {
    profile?: string;
  }
) {
  // State'ler
  const [route, setRoute] = useState<{
    geometry: RouteGeometry | null;
    distance: number;
    duration: number;
    provider?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rota hesaplayan fonksiyon
  const calculateRoute = useCallback(async () => {
    if (waypoints.length < 2 || loading) return;

    setLoading(true);
    setError(null);
    
    // Varsayılan options
    const defaultOptions = {
      profile: "foot-walking"
    };
    
    // Options'ları birleştir
    const mergedOptions = { 
      ...defaultOptions, 
      ...options 
    };
    
    try {
      const coords = waypoints.map(point => [point.lng, point.lat]);
      
      const response = await fetch("/api/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coords,
          profile: mergedOptions.profile
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
  }, [waypoints, options, loading]);

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
  }
) {
  // State'ler
  const [matrix, setMatrix] = useState<{
    durations: number[][] | null;
    distances: number[][] | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hesaplama fonksiyonu
  const calculateMatrix = useCallback(async () => {
    if (origins.length === 0 || destinations.length === 0 || loading) return;

    setLoading(true);
    setError(null);
    
    // Varsayılan options
    const defaultOptions = {
      profile: "foot-walking",
      metrics: ["duration", "distance"]
    };
    
    // Options'ları birleştir
    const mergedOptions = { 
      ...defaultOptions, 
      ...options 
    };
    
    try {
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
      setMatrix({
        durations: data.durations,
        distances: data.distances
      });
    } catch (err) {
      console.error("Mesafe matrisi hesaplama hatası:", err);
      setError(err instanceof Error ? err.message : "Mesafe matrisi hesaplanırken bilinmeyen bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [origins, destinations, options, loading]);

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
