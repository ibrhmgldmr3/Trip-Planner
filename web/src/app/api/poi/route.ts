import { NextRequest } from "next/server";
import { getPopularPlacesInCity, getNearbyPlaces } from "@/lib/services/google-maps-service";

// POI (Point of Interest) bilgilerini getiren API endpoint'i - [FR4]
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const lat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null;
  const lon = searchParams.get("lon") ? parseFloat(searchParams.get("lon")!) : null;
  
  if (!city && (lat === null || lon === null)) {
    return Response.json({ error: "Şehir adı veya koordinat (lat,lon) parametreleri gerekli" }, { status: 400 });
  }
  
  try {
    const type = searchParams.get("type") || "tourist_attraction";
    const limit = Number(searchParams.get("limit") || 5);
    const radius = Number(searchParams.get("radius") || 3000);
    
    let places;
    if (city) {
      places = await getPopularPlacesInCity(city, type, limit);
    } else {
      places = await getNearbyPlaces({ lat: lat!, lng: lon! }, radius, type, limit);
    }
    
    return Response.json({ pois: places });
  } catch (error) {
    console.error("Error fetching Google POIs:", error);
    return Response.json(
      { error: "Google POI bilgisi getirilirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
