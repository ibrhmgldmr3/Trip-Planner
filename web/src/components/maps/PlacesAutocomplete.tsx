"use client";

import { useEffect, useRef, useState } from "react";

interface PlacesAutocompleteProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
  autocompletionRequest?: google.maps.places.AutocompletionRequest;
  isLoaded?: boolean;
  showLocationButton?: boolean; // Konum butonunu gösterme seçeneği
}

export default function PlacesAutocomplete({
  onPlaceSelect,
  placeholder = "Bir konum ara...",
  className = "",
  autocompletionRequest,
  isLoaded: externalIsLoaded,
  showLocationButton = true, // Varsayılan olarak konum butonunu göster
}: PlacesAutocompleteProps) {
  // Input referansı
  const inputRef = useRef<HTMLInputElement>(null);
  // Autocomplete referansı
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  // Şu anki input değeri
  const [inputValue, setInputValue] = useState("");
  // Konum yükleniyor durumu
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  // Konum hatası
  const [locationError, setLocationError] = useState<string | null>(null);

  // Use only the external loading state
  // We can't load the API here separately because it would conflict with other loaders
  const isLoaded = externalIsLoaded !== undefined ? externalIsLoaded : false;
  const loadError = null;

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

  // Kullanıcının konumunu al
  const handleGetCurrentLocation = () => {
    if (!isLoaded || !google.maps) {
      setLocationError("Google Maps API henüz yüklenmedi.");
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const geocoder = new google.maps.Geocoder();
          
          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results, status) => {
              if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                const place = results[0];
                
                // Formatted address'i input'a yaz
                setInputValue(place.formatted_address || "");
                
                // Place seçildi olarak işaretle
                onPlaceSelect({
                  geometry: {
                    location: new google.maps.LatLng(latitude, longitude),
                  },
                  formatted_address: place.formatted_address,
                  place_id: place.place_id,
                  name: place.formatted_address,
                  address_components: place.address_components,
                } as google.maps.places.PlaceResult);
              } else {
                setLocationError("Adres bulunamadı. Lütfen manuel olarak girin.");
              }
              setIsLoadingLocation(false);
            }
          );
        },
        (error) => {
          console.error("Konum alınamadı:", error);
          let errorMessage = "Konum alınamadı.";
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Konum izni reddedildi. Lütfen konum erişimine izin verin.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Konum bilgisi kullanılamıyor.";
              break;
            case error.TIMEOUT:
              errorMessage = "Konum isteği zaman aşımına uğradı.";
              break;
          }
          
          setLocationError(errorMessage);
          setIsLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Tarayıcınız konum hizmetlerini desteklemiyor.");
      setIsLoadingLocation(false);
    }
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
      <div className="flex">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full p-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
          disabled={!isLoaded || isLoadingLocation}
        />
        {showLocationButton && (
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={!isLoaded || isLoadingLocation}
            className="flex items-center justify-center p-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            title="Konumumu Kullan"
          >
            {isLoadingLocation ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        )}
      </div>
      
      {locationError && (
        <div className="mt-1 text-sm text-red-600">
          {locationError}
        </div>
      )}
      
      {!isLoaded && !isLoadingLocation && (
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
