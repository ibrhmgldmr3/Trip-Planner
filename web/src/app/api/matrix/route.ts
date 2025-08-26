import { NextRequest } from "next/server";
import { z } from "zod";
import { calculateDistanceMatrix } from "@/lib/services/google-maps-service";
import { TravelMode } from "@googlemaps/google-maps-services-js";

// Input validation schema
const matrixRequestSchema = z.object({
  coords: z
    .array(z.array(z.number()).length(2))
    .min(2, "At least 2 coordinates are required")
    .max(25, "Maximum 25 coordinates allowed for matrix calculation"),
  profile: z
    .enum([
      "driving-car",
      "cycling-regular",
      "foot-walking"
    ])
    .default("foot-walking"),
  metrics: z.array(z.enum(["duration", "distance"])).default(["duration"]),
});

// Validate coordinate bounds
function validateCoordinates(coords: number[][]): boolean {
  return coords.every(([lng, lat]) => 
    lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
  );
}

// ORS profile to Google Maps TravelMode conversion
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

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = matrixRequestSchema.safeParse(rawBody);
    
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

    const { coords, profile, metrics } = validationResult.data;

    // Additional coordinate validation
    if (!validateCoordinates(coords)) {
      return Response.json(
        { error: "Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90" },
        { status: 400 }
      );
    }
    
    try {
      // Koordinatları LatLngLiteral formatına dönüştür
      const points = coords.map(([lng, lat]) => ({ lat, lng }));
      const travelMode = profileToTravelMode(profile);
      
      // Google Maps API ile mesafe matrisini hesapla
      const matrixResult = await calculateDistanceMatrix(points, points, travelMode);
      
      if (!matrixResult) {
        return Response.json(
          { error: "Google Maps API could not calculate a distance matrix" },
          { status: 404 }
        );
      }
      
      // Sonucu ORS formatına dönüştür
      const durations: number[][] = [];
      const distances: number[][] = [];
      
      matrixResult.rows.forEach((row, i) => {
        durations[i] = [];
        distances[i] = [];
        
        row.elements.forEach((element, j) => {
          durations[i][j] = element.duration?.value ?? null;
          distances[i][j] = element.distance?.value ?? null;
        });
      });
      
      const result = {
        provider: "google",
        durations: metrics.includes("duration") ? durations : null,
        distances: metrics.includes("distance") ? distances : null,
        metadata: {
          locations: coords.length,
          profile: profile,
          metrics: metrics
        }
      };
      
      return Response.json(result, {
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600', // Cache for 5 minutes
        }
      });
    } catch (error) {
      console.error("Google Maps API matrix error:", error);
      return Response.json(
        { error: "Failed to calculate matrix with Google Maps API" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Matrix API error:", error);
    
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

// Add GET method for API info
export async function GET(): Promise<Response> {
  const result = {
    service: "Matrix API",
    description: "Calculate duration/distance matrix between multiple points",
    status: "healthy",
    timestamp: new Date().toISOString(),
    google: {
      maxLocations: 25,
      profiles: [
        "driving-car", // maps to TravelMode.driving
        "cycling-regular", // maps to TravelMode.bicycling
        "foot-walking" // maps to TravelMode.walking
      ],
      metrics: ["duration", "distance"],
    }
  };
  
  return Response.json(result);
}
