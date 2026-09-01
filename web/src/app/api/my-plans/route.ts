import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { logger } from "@/lib/logger";


export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    // Kullanıcının kendi planlarını getir
    const plans = await prisma.tripPlan.findMany({
      where: {
        userId: auth.user.id
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
    
    return NextResponse.json(
      { 
        error: "Planlar yüklenemedi"
      },
      { status: 500 }
    );
  }
}

