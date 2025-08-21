import { NextRequest } from "next/server";

interface POI {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: string;
  category: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    shop?: string;
    amenity?: string;
    historic?: string;
    tourism?: string;
    leisure?: string;
    cuisine?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// Validate coordinates
function isValidCoordinate(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// Get category for POI based on tags
function getCategory(tags: OverpassElement['tags']): string {
  if (!tags) return 'other';
  
  if (tags.amenity === 'ice_cream' || tags.shop === 'bakery' || tags.cuisine?.includes('dessert')) {
    return 'food';
  }
  if (tags.historic) return 'historic';
  if (tags.tourism) return 'tourism';
  if (tags.amenity) return 'amenity';
  if (tags.shop) return 'shop';
  if (tags.leisure) return 'leisure';
  
  return 'other';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parse and validate parameters
    const latParam = searchParams.get('lat');
    const lonParam = searchParams.get('lon');
    const radiusParam = searchParams.get('radius');
    
    if (!latParam || !lonParam) {
      return Response.json(
        { error: "Missing required parameters: lat and lon" },
        { status: 400 }
      );
    }
    
    const lat = parseFloat(latParam);
    const lon = parseFloat(lonParam);
    const radius = radiusParam ? parseInt(radiusParam, 10) : 3000;
    
    // Validate coordinates
    if (!isValidCoordinate(lat, lon)) {
      return Response.json(
        { error: "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180" },
        { status: 400 }
      );
    }
    
    // Validate radius
    if (radius < 100 || radius > 50000) {
      return Response.json(
        { error: "Radius must be between 100 and 50000 meters" },
        { status: 400 }
      );
    }

    // Build Overpass query - fixed syntax
    const overpassQuery = `
[out:json][timeout:25];
(
  node["amenity"="ice_cream"](around:${radius},${lat},${lon});
  node["amenity"="cafe"]["cuisine"~"dessert|cake|pastry",i](around:${radius},${lat},${lon});
  node["shop"="bakery"](around:${radius},${lat},${lon});
  node["shop"="confectionery"](around:${radius},${lat},${lon});
  node["historic"](around:${radius},${lat},${lon});
  node["tourism"="attraction"](around:${radius},${lat},${lon});
  node["tourism"="museum"](around:${radius},${lat},${lon});
  node["amenity"="restaurant"](around:${radius},${lat},${lon});
  node["amenity"="cafe"](around:${radius},${lat},${lon});
  node["leisure"="park"](around:${radius},${lat},${lon});
  way["amenity"="ice_cream"](around:${radius},${lat},${lon});
  way["shop"="bakery"](around:${radius},${lat},${lon});
  way["historic"](around:${radius},${lat},${lon});
  way["tourism"="attraction"](around:${radius},${lat},${lon});
  way["tourism"="museum"](around:${radius},${lat},${lon});
  way["amenity"="restaurant"](around:${radius},${lat},${lon});
  way["amenity"="cafe"](around:${radius},${lat},${lon});
  way["leisure"="park"](around:${radius},${lat},${lon});
);
out center 50;`;

    // Make request to Overpass API
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "trip-planner/1.0"
      },
      body: new URLSearchParams({ data: overpassQuery }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Overpass API error (${response.status}):`, errorText);
      return Response.json(
        { error: "Failed to fetch POIs from Overpass API" },
        { status: response.status }
      );
    }

    const data: OverpassResponse = await response.json();

    // Process and filter POIs
    const pois: POI[] = (data?.elements ?? [])
      .map((el: OverpassElement) => {
        const elementLat = el.lat ?? el.center?.lat;
        const elementLon = el.lon ?? el.center?.lon;
        
        if (!elementLat || !elementLon || !Number.isFinite(elementLat) || !Number.isFinite(elementLon)) {
          return null;
        }
        
        const category = getCategory(el.tags);
        const name = el.tags?.name || 
                    (el.tags?.shop ? `${el.tags.shop}` : '') ||
                    (el.tags?.amenity ? `${el.tags.amenity}` : '') ||
                    (el.tags?.historic ? `Historic ${el.tags.historic}` : '') ||
                    (el.tags?.tourism ? `${el.tags.tourism}` : '') ||
                    "Unnamed POI";
        
        const kind = el.tags?.shop || el.tags?.amenity || el.tags?.historic || el.tags?.tourism || el.tags?.leisure || 'unknown';
        
        return {
          id: `osm-${el.type}-${el.id}`,
          name,
          lat: elementLat,
          lon: elementLon,
          kind,
          category
        };
      })
      .filter((poi): poi is POI => poi !== null)
      .slice(0, 50); // Limit to 50 POIs for performance

    return Response.json({ 
      pois,
      metadata: {
        count: pois.length,
        center: { lat, lon },
        radius,
        source: 'overpass'
      }
    });

  } catch (error) {
    console.error("Overpass API error:", error);
    
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }
    
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
