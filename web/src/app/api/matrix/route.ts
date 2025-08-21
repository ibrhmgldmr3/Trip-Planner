import { NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/env";
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
      "driving-hgv", 
      "cycling-regular",
      "cycling-road",
      "cycling-mountain",
      "cycling-electric",
      "foot-walking",
      "foot-hiking",
      "wheelchair"
    ])
    .default("foot-walking"),
  metrics: z.array(z.enum(["duration", "distance"])).default(["duration"]),
  provider: z.enum(["openrouteservice", "google"]).default("openrouteservice"),
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
    case "driving-hgv":
      return TravelMode.driving;
    case "cycling-regular":
    case "cycling-road":
    case "cycling-mountain":
    case "cycling-electric":
      return TravelMode.bicycling;
    case "foot-walking":
    case "foot-hiking":
    case "wheelchair":
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

    const { coords, profile, metrics, provider } = validationResult.data;

    // Additional coordinate validation
    if (!validateCoordinates(coords)) {
      return Response.json(
        { error: "Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90" },
        { status: 400 }
      );
    }
    
    // Google Maps API kullanarak hesaplama
    if (provider === "google") {
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
    }

    // OpenRouteService API ile hesaplama (varsayılan)
    // Check if API key is available
    if (!env.ORS_API_KEY || env.ORS_API_KEY.length < 10) {
      console.error("ORS_API_KEY is missing or invalid");
      return Response.json(
        { error: "API configuration error. Please check your OpenRouteService API key." },
        { status: 500 }
      );
    }

    // Make request to OpenRouteService Matrix API
    const requestBody = {
      locations: coords,
      metrics: metrics,
      units: "m"
    };

    console.log(`Making matrix request for ${coords.length} locations with profile ${profile}`);

    const response = await fetch(`https://api.openrouteservice.org/v2/matrix/${profile}`, {
      method: "POST",
      headers: { 
        Authorization: env.ORS_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "trip-planner/1.0"
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouteService Matrix API error (${response.status}):`, errorText);
      
      // Handle specific error cases
      if (response.status === 401) {
        return Response.json(
          { 
            error: "Invalid API key. Please check your OpenRouteService API key configuration.",
            hint: "Make sure ORS_API_KEY is set in your environment variables."
          },
          { status: 500 }
        );
      } else if (response.status === 403) {
        return Response.json(
          { 
            error: "API access forbidden. This could be due to:",
            reasons: [
              "Invalid API key",
              "API quota exceeded",
              "Account suspended",
              "Service not enabled for your account"
            ],
            hint: "Check your OpenRouteService dashboard at https://openrouteservice.org/dev/#/home"
          },
          { status: 429 }
        );
      } else if (response.status === 422) {
        return Response.json(
          { error: "Invalid matrix parameters. Check your coordinates and profile." },
          { status: 400 }
        );
      } else if (response.status === 429) {
        return Response.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      
      return Response.json(
        { 
          error: "Failed to calculate matrix",
          details: errorText.substring(0, 200)
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Validate response data
    if (!data.durations && !data.distances) {
      return Response.json(
        { error: "Invalid response from matrix service" },
        { status: 502 }
      );
    }

    const result = {
      provider: "openrouteservice",
      durations: data.durations || null,
      distances: data.distances || null,
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
export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") || "all";
  
  const result: Record<string, any> = {
    service: "Matrix API",
    description: "Calculate duration/distance matrix between multiple points",
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
  
  if (provider === "all" || provider === "openrouteservice") {
    result.openrouteservice = {
      maxLocations: 25,
      profiles: [
        "driving-car",
        "driving-hgv", 
        "cycling-regular",
        "cycling-road",
        "cycling-mountain",
        "cycling-electric",
        "foot-walking",
        "foot-hiking",
        "wheelchair"
      ],
      metrics: ["duration", "distance"],
      documentation: "https://openrouteservice.org/dev/#/api-docs/v2/matrix"
    };
  }
  
  if (provider === "all" || provider === "google") {
    result.google = {
      maxLocations: 25, // Google'ın limiti daha yüksek olabilir
      profiles: [
        "driving-car", // maps to TravelMode.driving
        "cycling-regular", // maps to TravelMode.bicycling
        "foot-walking" // maps to TravelMode.walking
      ],
      metrics: ["duration", "distance"],
    };
  }
  
  return Response.json(result);
}
