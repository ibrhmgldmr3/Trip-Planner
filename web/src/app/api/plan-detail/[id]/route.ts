import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { logger } from "@/lib/logger";


export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;
    
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
        // Yalnızca yetkilendirme için okunuyor; yanıttan çıkarılıyor.
        userId: true,
        status: true
      }
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
      );
    }

    // Kullanıcının kendi planı olup olmadığını kontrol et
    if (plan.userId !== user.id) {
      return NextResponse.json(
        { error: "Bu plana erişim yetkiniz yok" },
        { status: 403 }
      );
    }


    // Sahip id'si yanıtta yer almıyor; istemci için bir faydası yok.
    const { userId: _sahipId, ...planResponse } = plan;
    void _sahipId;

    return NextResponse.json({
      success: true,
      plan: planResponse
    });

  } catch (error: unknown) {
    logger.error("Plan detayı getirilemedi", error);
    
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;
    const body = await request.json();
    
    
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

    // Plan varlığını ve kullanıcı yetkisini kontrol et
    const existingPlan = await prisma.tripPlan.findUnique({
      where: { id: planId },
      select: { userId: true }
    });

    if (!existingPlan) {
      return NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
      );
    }

    if (existingPlan.userId !== user.id) {
      return NextResponse.json(
        { error: "Bu plana erişim yetkiniz yok" },
        { status: 403 }
      );
    }

    // Güncelleme verisini hazırla
    const updateData: {
      total_cost?: number;
      daily_cost?: number;
      butce_tahmini?: string;
    } = {};
    
    if (body.total_cost !== undefined) {
      updateData.total_cost = Number(body.total_cost);
    }
    
    if (body.daily_cost !== undefined) {
      updateData.daily_cost = Number(body.daily_cost);
    }
    
    if (body.butce_tahmini !== undefined) {
      updateData.butce_tahmini = body.butce_tahmini;
    }

    // Planı güncelle
    const updatedPlan = await prisma.tripPlan.update({
      where: { id: planId },
      data: updateData,
      select: {
        id: true,
        total_cost: true,
        daily_cost: true,
        butce_tahmini: true
      }
    });

    logger.info("Plan maliyeti güncellendi", { planId });

    return NextResponse.json({
      success: true,
      plan: updatedPlan
    });

  } catch (error: unknown) {
    logger.error("Plan maliyeti güncellenemedi", error);
    
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
        error: "Plan maliyeti güncellenemedi",
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;
    const body = await request.json();
    
    
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

    // Plan varlığını ve kullanıcı yetkisini kontrol et
    const existingPlan = await prisma.tripPlan.findUnique({
      where: { id: planId },
      select: { userId: true }
    });

    if (!existingPlan) {
      return NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
      );
    }

    if (existingPlan.userId !== user.id) {
      return NextResponse.json(
        { error: "Bu plana erişim yetkiniz yok" },
        { status: 403 }
      );
    }

    // Güncelleme verisini hazırla
    const updateData: {
      gun_plani?: string;
    } = {};
    
    if (body.daily_plans !== undefined) {
      updateData.gun_plani = body.daily_plans;
    }

    // Planı güncelle
    const updatedPlan = await prisma.tripPlan.update({
      where: { id: planId },
      data: updateData,
      select: {
        id: true,
        gun_plani: true
      }
    });

    logger.info("Günlük planlar güncellendi", { planId });

    return NextResponse.json({
      success: true,
      plan: updatedPlan
    });

  } catch (error: unknown) {
    logger.error("Günlük planlar güncellenemedi", error);
    
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
        error: "Günlük planlar güncellenemedi",
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
