import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { gunSayisi } from "@/lib/trip-dates";
import { logger } from "@/lib/logger";

/**
 * `preferences` sütununu güvenle objeye çevirir.
 *
 * Sütun `Json` tipinde ama eski satırlar JSON.stringify edilmiş METİN
 * taşıyor (profile/update eskiden öyle yazıyordu). İki biçimi de okumak
 * zorundayız; aksi halde eski profillerdeki telefon/bio/konum kayboluyor.
 */
function tercihleriCoz(value: unknown): Record<string, unknown> {
  if (!value) return {};

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

/** Serbest metin alanını güvenle string'e indirger. */
function metin(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}


export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
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
    const preferences = tercihleriCoz(user.preferences);

    // Profile objesini oluştur
    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      phone: metin(preferences.phone),
      bio: metin(preferences.bio),
      location: metin(preferences.location),
      birthDate: metin(preferences.birthDate),
      preferredTransport: user.preferredTransport,
      preferredCurrency: user.preferredCurrency,
      interests: user.interests,
      preferences,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    // Kullanıcının seyahat istatistiklerini hesapla
    const tripStats = await prisma.tripPlan.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: { id: true },
      _sum: { total_cost: true },
    });

    // Toplam seyahat sayısı
    const totalTrips = await prisma.tripPlan.count({
      where: { userId: user.id },
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
      where: { userId: user.id },
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      take: 1,
    });

    // Ortalama seyahat süresi (gün olarak)
    const tripDurations = await prisma.tripPlan.findMany({
      where: { 
        userId: user.id,
        startDate: { not: null },
        endDate: { not: null }
      },
      select: { startDate: true, endDate: true },
    });

    // Gün sayısı KAPSAYICI hesaplanıyor (bkz. src/lib/trip-dates.ts);
    // eskiden 1-5 Ocak seyahati 4 gün sayılıyordu. Ayrıca tarihleri ters
    // girilmiş satırlar ortalamayı bozmasın diye eleniyor.
    const gecerliSureler = tripDurations
      .map((trip) => gunSayisi(trip.startDate, trip.endDate))
      .filter((gun) => gun > 0);

    const averageTripDuration =
      gecerliSureler.length > 0
        ? Math.round(
            gecerliSureler.reduce((sum, gun) => sum + gun, 0) / gecerliSureler.length
          )
        : 0;

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
    logger.error("Profil getirilemedi", error);
    
    // Hata ayrıntısı yalnızca sunucu log'una; istemciye genel mesaj.
    return NextResponse.json(
      { success: false, error: "Profil bilgileri getirilemedi" },
      { status: 500 }
    );
  }
}

