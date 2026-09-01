import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { tripCreateSchema, tripUpdateSchema, ilkHataMesaji } from "@/lib/api-schemas";
import { tarihiCoz } from "@/lib/trip-dates";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    // If ID is provided, fetch a specific trip
    if (id) {
      const trip = await prisma.trip.findUnique({
        where: {
          id,
          userId: userId,
        },
        include: {
          activities: true,
          accommodations: true,
          transportations: true,
          dailyPlans: true,
          budgetItems: true,
        },
      });

      if (!trip) {
        return NextResponse.json(
          { error: "Trip not found or access denied" },
          { status: 404 }
        );
      }

      return NextResponse.json({ trip });
    }

    // Otherwise fetch all trips for the user
    const trips = await prisma.trip.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        startDate: 'desc',
      },
      include: {
        _count: {
          select: {
            activities: true,
            accommodations: true,
            transportations: true,
            dailyPlans: true,
            budgetItems: true,
          },
        },
      },
    });

    return NextResponse.json({ trips });
  } catch (error) {
    logger.error("Seyahatler getirilemedi", error);
    return NextResponse.json(
      { error: "Failed to fetch trips" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    const parsed = tripCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Seyahat bilgileri geçersiz") },
        { status: 400 }
      );
    }

    const { title, description, startDate, endDate, city, country, budget } = parsed.data;

    const baslangic = tarihiCoz(startDate);
    const bitis = tarihiCoz(endDate);

    if (!baslangic || !bitis) {
      return NextResponse.json({ error: "Geçersiz tarih formatı" }, { status: 400 });
    }

    // Eskiden bu kontrol hiç yoktu: bitiş tarihi başlangıçtan önce olan
    // seyahatler kaydedilebiliyor, sonra gün sayısı hesapları bozuluyordu.
    if (bitis < baslangic) {
      return NextResponse.json(
        { error: "Bitiş tarihi başlangıç tarihinden önce olamaz" },
        { status: 400 }
      );
    }

    // Create new trip
    const trip = await prisma.trip.create({
      data: {
        title,
        description: description ?? null,
        startDate: baslangic,
        endDate: bitis,
        city,
        country: country ?? null,
        budget: budget ?? null,
        userId,
      },
    });

    return NextResponse.json({ trip });
  } catch (error) {
    logger.error("Seyahat oluşturulamadı", error);
    return NextResponse.json(
      { error: "Failed to create trip" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    const parsed = tripUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Seyahat bilgileri geçersiz") },
        { status: 400 }
      );
    }

    const { id, title, description, startDate, endDate, city, country, budget, status } =
      parsed.data;

    // Check if trip exists and belongs to the user
    const existingTrip = await prisma.trip.findUnique({
      where: {
        id,
        userId,
      },
    });

    if (!existingTrip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 }
      );
    }

    const baslangic = startDate ? tarihiCoz(startDate) : existingTrip.startDate;
    const bitis = endDate ? tarihiCoz(endDate) : existingTrip.endDate;

    if (!baslangic || !bitis) {
      return NextResponse.json({ error: "Geçersiz tarih formatı" }, { status: 400 });
    }

    if (bitis < baslangic) {
      return NextResponse.json(
        { error: "Bitiş tarihi başlangıç tarihinden önce olamaz" },
        { status: 400 }
      );
    }

    // Update trip
    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        title: title ?? existingTrip.title,
        description: description ?? existingTrip.description,
        startDate: baslangic,
        endDate: bitis,
        city: city ?? existingTrip.city,
        country: country ?? existingTrip.country,
        // `parseFloat(budget)` sayısal olmayan girdide NaN üretiyordu;
        // artık şema sayı olmayanı zaten reddediyor.
        budget: budget ?? existingTrip.budget,
        status: status ?? existingTrip.status,
      },
    });

    return NextResponse.json({ trip: updatedTrip });
  } catch (error) {
    logger.error("Seyahat güncellenemedi", error);
    return NextResponse.json(
      { error: "Failed to update trip" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Trip ID is required" },
        { status: 400 }
      );
    }

    // Check if trip exists and belongs to the user
    const existingTrip = await prisma.trip.findUnique({
      where: {
        id,
        userId: userId,
      },
    });

    if (!existingTrip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 }
      );
    }

    // Delete trip
    await prisma.trip.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Seyahat silinemedi", error);
    return NextResponse.json(
      { error: "Failed to delete trip" },
      { status: 500 }
    );
  }
}

