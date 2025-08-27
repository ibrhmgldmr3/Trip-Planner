import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;
    console.log(`📋 Plan detayı getiriliyor: ${planId}`);
    
    // Session kontrolü
    const session = await getServerSession();
    
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

    // Planı getir ve kullanıcının kendi planı olup olmadığını kontrol et
    const plan = await prisma.tripPlan.findUnique({
      where: {
        id: planId
      },
      select: {
        id: true,
        city: true,
        country: true,
        startDate: true,
        endDate: true,
        duration: true,
        total_cost: true,
        daily_cost: true,
        ai_model: true,
        createdAt: true,
        travel_style: true,
        budget_level: true,
        interests: true,
        accommodation: true,
        transportation: true,
        sehir_bilgisi: true,
        gun_plani: true,
        yemek_rehberi: true,
        pratik_bilgiler: true,
        butce_tahmini: true,
        raw_markdown: true,
        raw_html: true,
        user_id: true
      }
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
      );
    }

    // Kullanıcının kendi planı olup olmadığını kontrol et
    if (plan.user_id !== user.id) {
      return NextResponse.json(
        { error: "Bu plana erişim yetkiniz yok" },
        { status: 403 }
      );
    }

    console.log(`✅ Plan detayı başarıyla getirildi: ${plan.city}`);

    return NextResponse.json({
      success: true,
      plan: plan
    });

  } catch (error: unknown) {
    console.error("💥 Plan detayı getirme hatası:", error);
    
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
        error: "Plan detayı yüklenemedi",
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
