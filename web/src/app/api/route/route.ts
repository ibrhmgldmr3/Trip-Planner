import { NextRequest } from "next/server";
import { z } from "zod";
import { getDirections, optimizeRoute } from "@/lib/services/google-maps-service";
import { TravelMode } from "@googlemaps/google-maps-services-js";

// Type definitions
interface GeoJSONGeometry {
  type: string;
  coordinates: number[][];
}

interface RouteInstruction {
  distance: number;
  duration: number;
  type: number;
  instruction: string;
  name?: string;
  way_points: number[];
}

interface RouteWarning {
  code: number;
  message: string;
}

interface RouteResponse {
  geometry: GeoJSONGeometry | null;
  distance?: number;
  duration?: number;
  instructions?: RouteInstruction[];
  summary?: {
    distance: number;
    duration: number;
  };
  warnings?: RouteWarning[];
  provider?: string;
}

// Input validation schema
const routeRequestSchema = z.object({
  coords: z
    .array(z.array(z.number()).length(2))
    .min(2, "At least 2 coordinates are required")
    .max(50, "Maximum 50 coordinates allowed"),
  profile: z
    .enum([
      "driving-car",
      "cycling-regular",
      "foot-walking"
    ])
    .default("foot-walking"),
  options: z.object({
    avoid_features: z.array(z.string()).optional(),
    preference: z.enum(["fastest", "shortest", "recommended"]).optional(),
    units: z.enum(["m", "km", "mi"]).optional(),
    language: z.string().optional(),
    suppressWarnings: z.boolean().optional(),
  }).optional(),
});

type RouteRequest = z.infer<typeof routeRequestSchema>;

// Validate coordinate bounds (rough world bounds check)
function validateCoordinates(coords: number[][]): boolean {
  return coords.every(([lng, lat]) => 
    lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
  );
}

// Google Maps API için profil dönüşümü
function profileToTravelMode(profile: string): TravelMode {
  switch (profile) {
    case "driving-car":
      return TravelMode.driving;
    case "cycling-regular":
      return TravelMode.bicycling;
    case "foot-walking":
      return TravelMode.walking;
    default:
      return TravelMode.walking;
  }
}

// Google Maps route response'unu GeoJSON formatına dönüştür
function googleRouteToGeoJSON(polyline: string): GeoJSONGeometry {
  // Google Directions API'den dönen encoded polyline'ı çöz
  const points = decodePolyline(polyline);
  
  // GeoJSON formatına dönüştür
  return {
    type: "LineString",
    coordinates: points.map(point => [point.lng, point.lat]) // GeoJSON'da [lng, lat] sırası kullanılır
  };
}

// Google polyline kodunu çözen fonksiyon
function decodePolyline(encoded: string) {
  const points: Array<{lat: number, lng: number}> = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5
    });
  }
  
  return points;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = routeRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return Response.json(
        { 
          error: "Invalid request data",
          details: validationResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const { coords, profile }: RouteRequest = validationResult.data;

    // Additional coordinate validation
    if (!validateCoordinates(coords)) {
      return Response.json(
        { error: "Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90" },
        { status: 400 }
      );
    }

    try {
      const points = coords.map(([lng, lat]) => ({ lat, lng }));
      const travelMode = profileToTravelMode(profile);
      
      if (points.length === 2) {
        // İki nokta arasında basit yönlendirme
        const route = await getDirections(points[0], points[1], [], travelMode);
        
        if (!route) {
          return Response.json(
            { error: "Google Maps API could not calculate a route" },
            { status: 404 }
          );
        }
        
        const geometry = googleRouteToGeoJSON(route.overviewPolyline);
        
        return Response.json({
          provider: "google",
          geometry,
          distance: route.distance,
          duration: route.duration,
          summary: {
            distance: route.distance,
            duration: route.duration
          },
          instructions: route.legs[0].steps.map((step, index) => ({
            distance: step.distance.value,
            duration: step.duration.value,
            type: 0,
            instruction: step.instructions,
            way_points: [index, index + 1]
          }))
        });
      } else {
        // Çok noktalı optimizasyon
        const route = await optimizeRoute(points, travelMode);
        
        if (!route) {
          return Response.json(
            { error: "Google Maps API could not optimize the route" },
            { status: 404 }
          );
        }
        
        const geometry = googleRouteToGeoJSON(route.overviewPolyline);
        
        return Response.json({
          provider: "google",
          geometry,
          distance: route.distance,
          duration: route.duration,
          summary: {
            distance: route.distance,
            duration: route.duration
          },
          instructions: route.legs.flatMap((leg, legIndex) => 
            leg.steps.map((step, stepIndex) => ({
              distance: step.distance.value,
              duration: step.duration.value,
              type: 0,
              instruction: step.instructions,
              way_points: [legIndex + stepIndex, legIndex + stepIndex + 1]
            }))
          )
        });
      }
    } catch (error) {
      console.error("Google Maps API route error:", error);
      return Response.json(
        { error: "Failed to calculate route with Google Maps API" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Route API error:", error);
    
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Add GET method for health check
export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") || "all";
  
  interface HealthResponse {
    service: string;
    status: string;
    timestamp: string;
    google?: {
      profiles: string[];
    };
  }
  
  const result: HealthResponse = {
    service: "Route API",
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
  
  if (provider === "all" || provider === "google") {
    result.google = {
      profiles: [
        "driving-car", // maps to TravelMode.driving
        "cycling-regular", // maps to TravelMode.bicycling
        "foot-walking" // maps to TravelMode.walking
      ]
    };
  }
  
  return Response.json(result);
}
