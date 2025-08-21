import { NextRequest } from "next/server";
import { env } from "@/env";
import { getPopularPlacesInCity } from "@/lib/services/google-maps-service";

// POI (Point of Interest) bilgilerini getiren API endpoint'i - [FR4]
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const city = searchParams.get("city");
  const radius = searchParams.get("radius") ?? "3000";
  const kinds = searchParams.get("kinds") ?? "interesting_places,historic,foods";
  const provider = searchParams.get("provider") ?? "opentripmap"; // 'opentripmap' veya 'google'
  
  // Google Maps API kullanarak şehirdeki popüler yerleri getir
  if (provider === "google" && city) {
    try {
      const type = searchParams.get("type") || "tourist_attraction";
      const limit = Number(searchParams.get("limit") || 5);
      
      const places = await getPopularPlacesInCity(city, type, limit);
      return Response.json({ pois: places });
    } catch (error) {
      console.error("Error fetching Google POIs:", error);
      return Response.json(
        { error: "Google POI bilgisi getirilirken bir hata oluştu" },
        { status: 500 }
      );
    }
  }
  
  // OpenTripMap API'sini kullan (yedek)
  if (!lat || !lon) return Response.json({ error: "lat/lon required" }, { status: 400 });

  const url = `https://api.opentripmap.com/0.1/en/places/radius?radius=${radius}&lon=${lon}&lat=${lat}&kinds=${kinds}&limit=20&apikey=${env.OPENTRIPMAP_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return Response.json({ error: await r.text() }, { status: r.status });
  const data = await r.json();
  return Response.json({ pois: data?.features ?? [] }); // GeoJSON Feature[]
}
