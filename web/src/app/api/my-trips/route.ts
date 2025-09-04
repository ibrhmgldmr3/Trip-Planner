import { NextResponse } from "next/server";
import { PrismaClient, TripStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

const prisma = new PrismaClient();

export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Session kontrolü
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: "Giriş yapmanız gerekiyor" },
        { status: 401 }
      );
    }

    // Query parametrelerini al
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    
    console.log("?? My-trips API çağrısı:", {
      statusFilter,
      requestUrl: request.url
    });

    // Kullanıcıyı email ile bul
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    // Where clause'unu hazırla
    const whereClause: { user_id: string; status?: TripStatus } = { 
      user_id: user.id
    };

    // Eğer status filtresi varsa ekle
    if (statusFilter) {
      whereClause.status = statusFilter as TripStatus;
    }
    
    console.log("?? Where clause:", whereClause);

    // TripPlan tablosundan kullanıcının seyahatlerini getir
    const trips = await prisma.tripPlan.findMany({
      where: whereClause,
      orderBy: [
        { createdAt: 'desc' },
        { startDate: 'desc' }
      ],
      select: {
        id: true,
        city: true,
        country: true,
        startDate: true,
        endDate: true,
        total_cost: true,
        budget_level: true,
        travel_style: true,
        duration: true,
        status: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Response formatını düzenle
    const formattedTrips = trips.map(trip => ({
      id: trip.id,
      city: trip.city,
      country: trip.country,
      startDate: trip.startDate?.toISOString() || '',
      endDate: trip.endDate?.toISOString() || '',
      total_cost: trip.total_cost,
      budget_level: trip.budget_level,
      travel_style: trip.travel_style,
      duration: trip.duration,
      status: trip.status || 'PLANNED',
      completedAt: trip.completedAt?.toISOString() || null,
      createdAt: trip.createdAt.toISOString(),
    }));

    console.log("?? Bulunan planlar:", {
      toplamPlan: trips.length,
      statusFilter,
      planStatusleri: trips.map(t => ({ id: t.id, city: t.city, status: t.status }))
    });

    return NextResponse.json({
      success: true,
      trips: formattedTrips,
      count: formattedTrips.length
    });
  } catch (error: unknown) {
    console.error("My trips fetch hatası:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Seyahatler getirilemedi",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
