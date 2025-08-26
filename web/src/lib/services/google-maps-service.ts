import { Client, LatLngLiteral, TravelMode } from "@googlemaps/google-maps-services-js";

// Google Maps API için interfaces
interface GoogleDistance {
  text: string;
  value: number;
}

interface GoogleDuration {
  text: string;
  value: number;
}

interface GoogleLocation {
  lat: number;
  lng: number;
}

interface GoogleDirectionsLeg {
  start_address: string;
  end_address: string;
  start_location: GoogleLocation;
  end_location: GoogleLocation;
  distance: GoogleDistance;
  duration: GoogleDuration;
  steps: GoogleDirectionsStep[];
}

interface GoogleDirectionsStep {
  html_instructions: string;
  distance: GoogleDistance;
  duration: GoogleDuration;
  start_location: GoogleLocation;
  end_location: GoogleLocation;
  polyline?: { points: string };
  travel_mode?: string;
}

// Google Maps API istemcisi
const client = new Client({});

// API Key
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Places (Mekanlar) için arama fonksiyonu - [FR4]
export async function searchPlaces(query: string, location: LatLngLiteral, radius: number = 5000) {
  try {
    const response = await client.textSearch({
      params: {
        query,
        location: `${location.lat},${location.lng}`,
        radius,
        key: API_KEY,
      },
    });

    if (response.data.status === "OK") {
      return response.data.results.map((place) => ({
        id: place.place_id,
        name: place.name,
        address: place.formatted_address,
        location: {
          lat: place.geometry?.location.lat ?? 0,
          lng: place.geometry?.location.lng ?? 0,
        },
        rating: place.rating,
        types: place.types,
        photos: place.photos
          ? place.photos.map((photo) => ({
              reference: photo.photo_reference,
              width: photo.width,
              height: photo.height,
            }))
          : [],
      }));
    }
    return [];
  } catch (error) {
    console.error("Error searching places:", error);
    throw error;
  }
}

// Mekan detaylarını getiren fonksiyon - [FR4] için detaylı bilgi
export async function getPlaceDetails(placeId: string) {
  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: [
          "name",
          "formatted_address",
          "geometry",
          "rating",
          "opening_hours",
          "price_level",
          "website",
          "photo",
          "formatted_phone_number",
          "types",
        ],
        key: API_KEY,
      },
    });

    if (response.data.status === "OK") {
      return {
        id: placeId,
        name: response.data.result.name,
        address: response.data.result.formatted_address,
        location: {
          lat: response.data.result.geometry?.location.lat ?? 0,
          lng: response.data.result.geometry?.location.lng ?? 0,
        },
        rating: response.data.result.rating,
        openingHours: response.data.result.opening_hours?.weekday_text,
        priceLevel: response.data.result.price_level,
        website: response.data.result.website,
        phoneNumber: response.data.result.formatted_phone_number,
        types: response.data.result.types,
        photos: response.data.result.photos
          ? response.data.result.photos.map((photo) => ({
              reference: photo.photo_reference,
              width: photo.width,
              height: photo.height,
            }))
          : [],
      };
    }
    return null;
  } catch (error) {
    console.error("Error getting place details:", error);
    throw error;
  }
}

// Rotaları oluşturan fonksiyon - [FR5]
export async function getDirections(
  origin: LatLngLiteral,
  destination: LatLngLiteral,
  waypoints: LatLngLiteral[] = [],
  mode: TravelMode = TravelMode.walking
) {
  try {
    // Client'ı direkt olarak kullanmak yerine, fetch ile istek gönderelim
    const waypointsParam = waypoints.length > 0 
      ? `&waypoints=${waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|')}` 
      : '';
    
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointsParam}&mode=${mode.toLowerCase()}&key=${API_KEY}`;
    
    const fetchResponse = await fetch(url);
    const data = await fetchResponse.json();
    
    if (data.status === "OK") {
      const route = data.routes[0];
      const legs = route.legs.map((leg: GoogleDirectionsLeg) => ({
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        startLocation: {
          lat: leg.start_location.lat,
          lng: leg.start_location.lng,
        },
        endLocation: {
          lat: leg.end_location.lat,
          lng: leg.end_location.lng,
        },
        distance: leg.distance,
        duration: leg.duration,
        steps: leg.steps.map((step: GoogleDirectionsStep) => ({
          instructions: step.html_instructions,
          distance: step.distance,
          duration: step.duration,
          startLocation: {
            lat: step.start_location.lat,
            lng: step.start_location.lng,
          },
          endLocation: {
            lat: step.end_location.lat,
            lng: step.end_location.lng,
          },
          polyline: step.polyline?.points,
          travelMode: step.travel_mode,
        })),
      }));

      return {
        summary: route.summary,
        legs,
        overviewPolyline: route.overview_polyline.points,
        bounds: route.bounds,
        distance: legs.reduce(
          (total: number, leg: { distance: GoogleDistance }) => total + leg.distance.value,
          0
        ),
        duration: legs.reduce(
          (total: number, leg: { duration: GoogleDuration }) => total + leg.duration.value,
          0
        ),
      };
    }
    return null;
  } catch (error) {
    console.error("Error getting directions:", error);
    throw error;
  }
}

// Optimal rota oluşturma fonksiyonu - [FR5] çoklu mekanlarda
export async function optimizeRoute(
  places: LatLngLiteral[],
  mode: TravelMode = TravelMode.walking
) {
  if (places.length < 2) {
    return null;
  }

  try {
    const origin = places[0];
    const destination = places[places.length - 1];
    const waypoints = places.slice(1, places.length - 1);

    return await getDirections(origin, destination, waypoints, mode);
  } catch (error) {
    console.error("Error optimizing route:", error);
    throw error;
  }
}

// Foto URL'sini oluşturan yardımcı fonksiyon
export function getPhotoUrl(photoReference: string, maxWidth: number = 400) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${API_KEY}`;
}

// Şehir koordinatlarını bulan fonksiyon - Şehir isimlerini koordinatlara çevirmek için
export async function geocodeCity(cityName: string) {
  try {
    const response = await client.geocode({
      params: {
        address: cityName,
        key: process.env.GOOGLE_MAPS_API_KEY || "",
      },
    });

    if (response.data.status === "OK" && response.data.results.length > 0) {
      const result = response.data.results[0];
      return {
        formattedAddress: result.formatted_address,
        location: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        },
        placeId: result.place_id,
        viewport: result.geometry.viewport,
      };
    }
    return null;
  } catch (error) {
    console.error("Error geocoding city:", error);
    throw error;
  }
}

// Şehirdeki popüler mekanları getiren fonksiyon - [FR4]
export async function getPopularPlacesInCity(
  cityName: string,
  type: string = "tourist_attraction",
  limit: number = 5
) {
  try {
    const cityData = await geocodeCity(cityName);
    if (!cityData) {
      return [];
    }

    const response = await client.placesNearby({
      params: {
        location: `${cityData.location.lat},${cityData.location.lng}`,
        radius: 10000, // 10km yarıçap
        type,
        // @ts-expect-error API dokümanında string olarak kabul ediliyor
        rankby: "prominence",
        key: API_KEY,
      },
    });

    if (response.data.status === "OK") {
      return response.data.results.slice(0, limit).map((place) => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        location: {
          lat: place.geometry?.location.lat ?? 0,
          lng: place.geometry?.location.lng ?? 0,
        },
        rating: place.rating,
        types: place.types,
        photos: place.photos
          ? place.photos.map((photo) => ({
              reference: photo.photo_reference,
              width: photo.width,
              height: photo.height,
            }))
          : [],
      }));
    }
    return [];
  } catch (error) {
    console.error("Error getting popular places:", error);
    throw error;
  }
}

// Belirli bir noktanın çevresindeki mekanları getiren fonksiyon
export async function getNearbyPlaces(
  location: LatLngLiteral,
  radius: number = 3000,
  type: string = "tourist_attraction",
  limit: number = 5
) {
  try {
    const response = await client.placesNearby({
      params: {
        location: `${location.lat},${location.lng}`,
        radius: radius,
        type,
        // @ts-expect-error API dokümanında string olarak kabul ediliyor
        rankby: "prominence",
        key: API_KEY,
      },
    });

    if (response.data.status === "OK") {
      return response.data.results.slice(0, limit).map((place) => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        location: {
          lat: place.geometry?.location.lat ?? 0,
          lng: place.geometry?.location.lng ?? 0,
        },
        rating: place.rating,
        types: place.types,
        photos: place.photos
          ? place.photos.map((photo) => ({
              reference: photo.photo_reference,
              width: photo.width,
              height: photo.height,
            }))
          : [],
      }));
    }
    return [];
  } catch (error) {
    console.error("Error getting nearby places:", error);
    throw error;
  }
}

// Mesafe matrisi hesaplama fonksiyonu - [FR5] ve [FR6] için rota optimizasyonu
export async function calculateDistanceMatrix(
  origins: LatLngLiteral[],
  destinations: LatLngLiteral[],
  mode: TravelMode = TravelMode.walking
) {
  try {
    const originsStr = origins
      .map((point) => `${point.lat},${point.lng}`)
      .join("|");
    const destinationsStr = destinations
      .map((point) => `${point.lat},${point.lng}`)
      .join("|");

    const response = await client.distancematrix({
      params: {
        // @ts-expect-error API dokümanında string olarak kabul ediliyor
        origins: originsStr,
        // @ts-expect-error API dokümanında string olarak kabul ediliyor
        destinations: destinationsStr,
        mode: mode,
        key: API_KEY,
      },
    });

    if (response.data.status === "OK") {
      return {
        origins: response.data.origin_addresses,
        destinations: response.data.destination_addresses,
        rows: response.data.rows.map((row) => ({
          elements: row.elements.map((element) => ({
            status: element.status,
            distance: element.distance,
            duration: element.duration,
          })),
        })),
      };
    }
    return null;
  } catch (error) {
    console.error("Error calculating distance matrix:", error);
    throw error;
  }
}
