import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { logger } from "@/lib/logger";


interface ManualTravelPlan {
  basicInfo: {
    destination: string;
    country: string;
    startDate: string;
    endDate: string;
    travelers: number;
    travelStyle: string;
  };
  transport: {
    id: string;
    type: string;
    provider: string;
    price: number;
    duration: string;
    departure: string;
    arrival: string;
  } | null;
  accommodation: {
    id: string;
    name: string;
    type: string;
    rating: number;
    price: number;
    location: string;
    amenities: string[];
  } | null;
  dailyPlans: Array<{
    day: number;
    activities: string[];
    notes: string;
    isEmpty: boolean;
  }>;
  budget: {
    currentBudget: number;
    estimatedTotal: number;
    breakdown: {
      transport: number;
      accommodation: number;
      activities: number;
      food: number;
      other: number;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const planData: ManualTravelPlan = await request.json();
    
    // Veri doğrulaması
    if (!planData.basicInfo.destination || !planData.basicInfo.startDate || !planData.basicInfo.endDate) {
      return NextResponse.json(
        { error: "Hedef şehir ve tarihler gereklidir" },
        { status: 400 }
      );
    }

    // Session'daki id bayat bir JWT'den gelebilir; TripPlan.user_id'ye FK
    // eklendiği için kullanıcıyı veritabanından doğruluyoruz.
    let userId: string | null = null;
    let userEmail: string | null = null;

    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, email: true },
        });
        userId = user?.id ?? null;
        userEmail = user?.email ?? null;
      }
    } catch (sessionError) {
      logger.error("Oturum bilgisi alınamadı", sessionError);
    }

    // Günlük planları JSON string'e çevir
    const dailyPlansJson = JSON.stringify(planData.dailyPlans);
    
    // Ulaşım bilgileri JSON string'e çevir
    const transportJson = planData.transport ? JSON.stringify(planData.transport) : null;
    
    // Konaklama bilgileri JSON string'e çevir
    const accommodationJson = planData.accommodation ? JSON.stringify(planData.accommodation) : null;

    // Seyahat süresini hesapla
    const startDate = new Date(planData.basicInfo.startDate);
    const endDate = new Date(planData.basicInfo.endDate);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    // Gidiş ve dönüş aynı gün ise 1 gün olarak hesapla
    const duration = daysDiff === 0 ? 1 : daysDiff;

    // Veritabanına kaydet
    const savedPlan = await prisma.tripPlan.create({
      data: {
        // Temel bilgiler
        city: planData.basicInfo.destination,
        country: planData.basicInfo.country || null,
        startDate: startDate,
        endDate: endDate,
        duration: `${duration} gün`,
        
        // Manuel plan verileri (JSON olarak)
        gun_plani: dailyPlansJson,
        
        // Seçilen hizmetler
        transportation: transportJson,
        accommodation: accommodationJson,
        
        // Bütçe bilgileri
        total_cost: planData.budget.estimatedTotal,
        budget_level: planData.basicInfo.travelStyle,
        
        // Meta veriler
        ai_model: "manual_planning",
        raw_markdown: `# ${planData.basicInfo.destination} Seyahat Planı\n\n## Tarih: ${planData.basicInfo.startDate} - ${planData.basicInfo.endDate}\n\n## Kişi Sayısı: ${planData.basicInfo.travelers}\n\n## Toplam Maliyet: ₺${planData.budget.estimatedTotal}`,
        
        // Diğer alanlar
        travel_style: planData.basicInfo.travelStyle,
        interests: JSON.stringify(['manuel_planlama']),
        
        // Maliyet detayları
        daily_cost: Math.round(planData.budget.estimatedTotal / duration),
        
        // Plan türü
        sehir_bilgisi: `Manuel olarak planlanmış ${planData.basicInfo.destination} seyahati`,
        pratik_bilgiler: `${planData.basicInfo.travelers} kişi için ${duration} günlük plan`,
        butce_tahmini: JSON.stringify(planData.budget.breakdown),
        
        // Sahiplik userId üzerinden. userEmail geçiş süresince yazılmaya
        // devam ediyor; ayrı bir migration'da düşürülecek.
        userId: userId,
        userEmail: userEmail,
      }
    });

    logger.info("Manuel plan kaydedildi", { planId: savedPlan.id });

    return NextResponse.json({
      success: true,
      planId: savedPlan.id,
      message: "Seyahat planınız başarıyla kaydedildi!",
      plan: {
        id: savedPlan.id,
        destination: planData.basicInfo.destination,
        duration: duration,
        totalCost: planData.budget.estimatedTotal,
        createdAt: savedPlan.createdAt
      }
    });

  } catch (error: unknown) {
    logger.error("Manuel plan kaydedilemedi", error);
    
    const errorDetails = error instanceof Error 
      ? { 
          name: error.name, 
          message: error.message,
          stack: error.stack 
        }
      : { 
          unknown: "Bilinmeyen hata tipi",
          value: String(error)
        };
    
    return NextResponse.json(
      { 
        error: "Plan kaydedilirken bir hata oluştu",
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

