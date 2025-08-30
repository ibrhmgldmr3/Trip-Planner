import { NextResponse } from "next/server";
import { PrismaClient, TripStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

const prisma = new PrismaClient();

export async function GET(): Promise<NextResponse> {
  try {
    // Session kontrolü
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: "Giriş yapmanız gerekiyor" },
        { status: 401 }
      );
    }

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

    // Sadece DONE statusundaki trip'leri getir
    const trips = await prisma.trip.findMany({
      where: { 
        userId: user.id,
        status: TripStatus.DONE
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        city: true,
        country: true,
        budget: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Response formatını düzenle
    const formattedTrips = trips.map(trip => ({
      id: trip.id,
      title: trip.title,
      description: trip.description,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate.toISOString(),
      city: trip.city,
      country: trip.country,
      budget: trip.budget,
      status: trip.status,
      createdAt: trip.createdAt.toISOString(),
      completedAt: trip.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      trips: formattedTrips,
    });
  } catch (error: unknown) {
    console.error("My trips fetch hatası:", error);
    
    return NextResponse.json(
      { error: "Tamamlanmış geziler getirilemedi" },
      { status: 500 }
    );
  }
}