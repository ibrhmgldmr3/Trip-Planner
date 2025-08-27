import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log("📋 Kaydedilmiş planlar getiriliyor...");
    console.log("🔍 API endpoint çağrıldı - /api/my-plans");
    
    // Session kontrolü
    const session = await getServerSession(authOptions);
    console.log("🔑 Session kontrol edildi:", session ? "Mevcut" : "Yok");
    
    if (!session || !session.user?.email) {
      console.log("❌ Session bulunamadı veya email eksik");
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
        user_id: user.id
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
        user_id: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Kullanıcı ${session.user.email} için ${plans.length} plan bulundu`);

    return NextResponse.json({
      success: true,
      plans: plans,
      count: plans.length
    });

  } catch (error: unknown) {
    console.error("💥 Planları getirme hatası:", error);
    
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
