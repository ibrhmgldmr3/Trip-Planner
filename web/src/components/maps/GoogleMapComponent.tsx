"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from "@react-google-maps/api";

// Harita konteyner stili
const containerStyle = {
  width: "100%",
  height: "500px",
};

// Google Maps API için kütüphaneler
const libraries = ["places", "geometry"];

export interface GoogleMapComponentProps {
  center?: google.maps.LatLngLiteral;
  zoom?: number;
  markers?: {
    id: string;
    position: google.maps.LatLngLiteral;
    title?: string;
    icon?: string | google.maps.Icon | google.maps.Symbol;
    draggable?: boolean;
    onClick?: () => void;
  }[];
  polylines?: {
    id: string;
    path: google.maps.LatLngLiteral[];
    options?: google.maps.PolylineOptions;
  }[];
  onMapClick?: (e: google.maps.MapMouseEvent) => void;
  onMarkerDragEnd?: (id: string, position: google.maps.LatLngLiteral) => void;
  apiKey?: string;
  mapOptions?: google.maps.MapOptions;
  isLoaded?: boolean;
}

const defaultOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  clickableIcons: true,
  scrollwheel: true,
  mapTypeControl: true,
  fullscreenControl: true,
  streetViewControl: true,
  mapTypeId: "roadmap",
};

export default function GoogleMapComponent({
  center = { lat: 41.0082, lng: 28.9784 }, // İstanbul (varsayılan konum)
  zoom = 12,
  markers = [],
  polylines = [],
  onMapClick,
  onMarkerDragEnd,
  apiKey,
  mapOptions = defaultOptions,
  isLoaded: externalIsLoaded,
}: GoogleMapComponentProps) {
  // API yüklemesi (eğer dışarıdan sağlanmadıysa)
  const apiLoader = useJsApiLoader({
    googleMapsApiKey: apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries as any,
  });
  
  // Dışarıdan API yükleme durumu sağlanmışsa onu kullan, değilse kendi durumunu kullan
  const isLoaded = externalIsLoaded !== undefined ? externalIsLoaded : apiLoader.isLoaded;
  const loadError = externalIsLoaded !== undefined ? null : apiLoader.loadError;

  // Harita referansı
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Seçilen marker için state
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  // Harita yüklendiğinde referansı kaydet
  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
    },
    []
  );

  // Marker'a tıklandığında
  const handleMarkerClick = useCallback((id: string) => {
    setSelectedMarker(id);
  }, []);

  // Marker sürüklendiğinde
  const handleMarkerDragEnd = useCallback(
    (id: string, event: google.maps.MapMouseEvent) => {
      if (event.latLng && onMarkerDragEnd) {
        const position = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        };
        onMarkerDragEnd(id, position);
      }
    },
    [onMarkerDragEnd]
  );

  // InfoWindow kapatıldığında
  const handleInfoWindowClose = useCallback(() => {
    setSelectedMarker(null);
  }, []);

  // Harita opsiyonları
  const options = useMemo(
    () => ({
      ...defaultOptions,
      ...mapOptions,
    }),
    [mapOptions]
  );
  
  // Yükleme hatası
  if (loadError) {
    return <div className="p-4 bg-red-100 text-red-500 rounded">Harita yüklenirken bir hata oluştu.</div>;
  }

  // Yükleniyor
  if (!isLoaded) {
    return <div className="p-4 text-center">Harita yükleniyor...</div>;
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        onLoad={onMapLoad}
        onClick={onMapClick}
        options={options}
      >
        {/* Marker'lar */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            title={marker.title}
            icon={marker.icon}
            draggable={marker.draggable}
            onClick={() => {
              if (marker.onClick) {
                marker.onClick();
              }
              handleMarkerClick(marker.id);
            }}
            onDragEnd={(e) => handleMarkerDragEnd(marker.id, e)}
          />
        ))}

        {/* InfoWindow */}
        {selectedMarker && (
          <InfoWindow
            position={markers.find((m) => m.id === selectedMarker)?.position}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="p-2">
              <h3 className="font-semibold text-gray-800">
                {markers.find((m) => m.id === selectedMarker)?.title}
              </h3>
            </div>
          </InfoWindow>
        )}

        {/* Polylines */}
        {polylines.map((polyline) => (
          <Polyline
            key={polyline.id}
            path={polyline.path}
            options={{
              strokeColor: "#4285F4",
              strokeOpacity: 0.8,
              strokeWeight: 5,
              ...polyline.options,
            }}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
