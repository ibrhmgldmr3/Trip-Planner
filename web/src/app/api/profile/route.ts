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
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        preferredTransport: true,
        preferredCurrency: true,
        interests: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    // Preferences JSON'dan ek bilgileri al
    const preferences = user.preferences as Record<string, unknown> || {};
    
    // Profile objesini oluştur
    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      phone: preferences.phone as string || null,
      bio: preferences.bio as string || null,
      location: preferences.location as string || null,
      birthDate: preferences.birthDate as string || null,
      preferredTransport: user.preferredTransport,
      preferredCurrency: user.preferredCurrency,
      interests: user.interests,
      preferences: user.preferences,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    // Kullanıcının seyahat istatistiklerini hesapla
    const tripStats = await prisma.tripPlan.groupBy({
      by: ['status'],
      where: { user_id: user.id },
      _count: { id: true },
      _sum: { total_cost: true },
    });

    // Toplam seyahat sayısı
    const totalTrips = await prisma.tripPlan.count({
      where: { user_id: user.id },
    });

    // Tamamlanan seyahatler
    const completedTrips = tripStats
      .filter(stat => stat.status === 'COMPLETED' || stat.status === 'DONE')
      .reduce((sum, stat) => sum + stat._count.id, 0);

    // Toplam bütçe
    const totalBudget = tripStats.reduce((sum, stat) => {
      return sum + (stat._sum.total_cost || 0);
    }, 0);

    // En popüler destinasyon
    const popularDestination = await prisma.tripPlan.groupBy({
      by: ['city'],
      where: { user_id: user.id },
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      take: 1,
    });

    // Ortalama seyahat süresi (gün olarak)
    const tripDurations = await prisma.tripPlan.findMany({
      where: { 
        user_id: user.id,
        startDate: { not: null },
        endDate: { not: null }
      },
      select: { startDate: true, endDate: true },
    });

    let averageTripDuration = 0;
    if (tripDurations.length > 0) {
      const totalDays = tripDurations.reduce((sum, trip) => {
        if (trip.startDate && trip.endDate) {
          const days = Math.ceil(
            (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 
            (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }
        return sum;
      }, 0);
      averageTripDuration = Math.round(totalDays / tripDurations.length);
    }

    const stats = {
      totalTrips,
      completedTrips,
      totalBudget,
      averageTripDuration,
      favoriteDestination: popularDestination[0]?.city || null,
    };

    return NextResponse.json({
      success: true,
      profile,
      stats,
    });
  } catch (error: unknown) {
    console.error("Profile fetch hatası:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Profil bilgileri getirilemedi",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
