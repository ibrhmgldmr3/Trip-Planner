import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { TripStatus, isTripStatus } from "@/lib/trip-status";
import { logger } from "@/lib/logger";


export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    // Query parametrelerini al
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // Where clause'unu hazırla
    const whereClause: { userId: string; status?: TripStatus } = {
      userId: auth.user.id
    };

    // Bilinmeyen bir status değeri geldiğinde eskiden `as TripStatus` ile
    // zorlanıp Prisma'da yakalanmamış hataya dönüşüyordu; artık 400.
    if (statusFilter) {
      if (!isTripStatus(statusFilter)) {
        return NextResponse.json(
          { error: "Geçersiz durum filtresi" },
          { status: 400 }
        );
      }
      whereClause.status = statusFilter;
    }

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

    logger.debug("Kullanıcının seyahatleri getirildi", {
      toplamPlan: trips.length,
      statusFilter,
    });

    return NextResponse.json({
      success: true,
      trips: formattedTrips,
      count: formattedTrips.length
    });
  } catch (error: unknown) {
    logger.error("Seyahatler getirilemedi", error);

    return NextResponse.json(
      { 
        success: false,
        error: "Seyahatler getirilemedi"
      },
      { status: 500 }
    );
  }
}
