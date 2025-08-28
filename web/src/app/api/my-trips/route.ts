import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
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

    // Kullanıcının tüm trip planlarını getir
    const trips = await prisma.tripPlan.findMany({
      where: { user_id: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        city: true,
        gun_plani: true,
        createdAt: true,
      },
    });

    // Response formatını düzenle
    const formattedTrips = trips.map(trip => ({
      id: trip.id,
      title: trip.city || 'Başlıksız Plan',
      description: 'Gezi planı detayları',
      createdAt: trip.createdAt?.toISOString() || '',
      city: trip.city,
    }));

    return NextResponse.json({
      success: true,
      trips: formattedTrips,
    });
  } catch (error: unknown) {
    console.error("My trips fetch hatası:", error);
    
    return NextResponse.json(
      { error: "Gezi planları getirilemedi" },
      { status: 500 }
    );
  }
}