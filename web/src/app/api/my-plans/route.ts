import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { logger } from "@/lib/logger";


export async function GET() {
  try {
    // Session kontrolü
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: "Giriş yapmanız gerekiyor" },
        { status: 401 }
      );
    }

    // Kullanıcıyı email ile bul ve ID'sini al
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    // Kullanıcının kendi planlarını getir
    const plans = await prisma.tripPlan.findMany({
      where: {
        userId: user.id
      },
      select: {
        id: true,
        city: true,
        country: true,
        startDate: true,
        endDate: true,
        duration: true,
        total_cost: true,
        ai_model: true,
        createdAt: true,
        travel_style: true,
        budget_level: true,
        // Sahip id'si istemciye gönderilmiyor; yetkilendirme zaten where ile yapıldı.
        status: true,
        completedAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    logger.debug("Kullanıcının planları getirildi", { planSayisi: plans.length });

    return NextResponse.json({
      success: true,
      plans: plans,
      count: plans.length
    });

  } catch (error: unknown) {
    logger.error("Planlar getirilemedi", error);

    const errorDetails = error instanceof Error 
      ? { 
          name: error.name, 
          message: error.message
        }
      : { 
          unknown: "Bilinmeyen hata tipi",
          value: String(error)
        };
    
    return NextResponse.json(
      { 
        error: "Planlar yüklenemedi",
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

