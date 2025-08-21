"use client";

import { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

// Google Maps API için kütüphaneler
const libraries = ["places"];

interface PlacesAutocompleteProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
  apiKey?: string;
  autocompletionRequest?: google.maps.places.AutocompletionRequest;
  isLoaded?: boolean;
}

export default function PlacesAutocomplete({
  onPlaceSelect,
  placeholder = "Bir konum ara...",
  className = "",
  apiKey,
  autocompletionRequest,
  isLoaded: externalIsLoaded,
}: PlacesAutocompleteProps) {
  // Input referansı
  const inputRef = useRef<HTMLInputElement>(null);
  // Autocomplete referansı
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  // Şu anki input değeri
  const [inputValue, setInputValue] = useState("");

  // API yüklemesi (eğer dışarıdan sağlanmadıysa)
  const apiLoader = useJsApiLoader({
    googleMapsApiKey: apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries as any,
  });
  
  // Dışarıdan API yükleme durumu sağlanmışsa onu kullan, değilse kendi durumunu kullan
  const isLoaded = externalIsLoaded !== undefined ? externalIsLoaded : apiLoader.isLoaded;
  const loadError = externalIsLoaded !== undefined ? null : apiLoader.loadError;

  // API yüklendiğinde Autocomplete'i başlat
  useEffect(() => {
    if (isLoaded && inputRef.current) {
      const options: google.maps.places.AutocompleteOptions = {
        fields: ["address_components", "geometry", "name", "formatted_address", "place_id"],
      };

      if (autocompletionRequest) {
        options.componentRestrictions = autocompletionRequest.componentRestrictions;
        options.types = autocompletionRequest.types;
      }

      autocompleteRef.current = new google.maps.places.Autocomplete(
        inputRef.current,
        options
      );

      // Place seçildiğinde event listener
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        if (place && place.geometry) {
          onPlaceSelect(place);
          // Input değerini güncelle
          if (place.formatted_address) {
            setInputValue(place.formatted_address);
          }
        }
      });
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current && google.maps) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onPlaceSelect, autocompletionRequest]);

  // Input değeri değiştiğinde
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Yükleme hatası
  if (loadError) {
    return (
      <div className="p-2 bg-red-100 text-red-500 rounded text-sm">
        Google Maps API yüklenemedi.
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
        disabled={!isLoaded}
      />
      {!isLoaded && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  );
}
