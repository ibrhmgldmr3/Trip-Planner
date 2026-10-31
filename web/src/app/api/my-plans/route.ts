import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { logger } from "@/lib/logger";
import { toplamlariTazele } from "@/lib/iliskisel-plan-ozeti";


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
        updatedAt: true,
        // İlişkisel modele taşınma durumu (B4). İstemci hangi veri yolunu
        // kullanacağına buna bakarak karar veriyor: `migratedAt` doluysa
        // bütçe/günlük plan ilişkisel uçlardan okunuyor, boşsa TripPlan'ın
        // JSON sütunlarından. İki yol bir süre yan yana yaşayacak.
        migratedAt: true,
        tripId: true,
        // Kalkış şehri: ulaşım ekranı güzergâhı buradan ön dolduruyor.
        // Sütun bu ana kadar yazılıp hiç okunmuyordu (bkz. schema notu).
        originCity: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // TAŞINMIŞ PLANLARIN TOPLAMI İLİŞKİSEL MODELDEN (B4 · Adım 5).
    //
    // `total_cost` artık SALT OKUNUR ARŞİV: taşınmış bir planda bütçe
    // kalemleri `BudgetItem` tablosunda yaşıyor ve sütun oradaki
    // değişiklikleri görmüyor. Eskiden bütçe sayfası kaydederken sütunu da
    // güncelliyordu (geçiş dönemi çift yazması); o yazma kaldırıldı ve
    // tazeleme buraya, okuma tarafına taşındı.
    const tazelenmis = await toplamlariTazele(plans);

    logger.debug("Kullanıcının planları getirildi", { planSayisi: plans.length });

    return NextResponse.json({
      success: true,
      plans: tazelenmis,
      count: tazelenmis.length
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

