import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { logger } from "@/lib/logger";


export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: tripId } = await context.params;
    
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    // Trip'i bul (Trip tablosundan, sadece DONE olanları)
    const trip = await prisma.trip.findUnique({
      where: { 
        id: tripId,
        userId: auth.user.id,
        status: 'DONE'
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Tamamlanmış gezi bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      trip: trip,
    });
  } catch (error: unknown) {
    logger.error("Seyahat detayı getirilemedi", error);
    
    return NextResponse.json(
      { error: "Yapılmış geziler getirilemedi" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: tripId } = await context.params;
    
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    // Trip var mı ve sahibi mi? (Trip tablosundan, sadece DONE olanları)
    const trip = await prisma.trip.findUnique({
      where: { 
        id: tripId,
        userId: auth.user.id,
        status: 'DONE'
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Tamamlanmış gezi bulunamadı" },
        { status: 404 }
      );
    }

    // Sil
    await prisma.trip.delete({ where: { id: tripId } });

    return NextResponse.json({
      success: true,
      message: "Tamamlanmış gezi başarıyla silindi",
    });
  } catch (error: unknown) {
    logger.error("Seyahat silinemedi", error);
    
    return NextResponse.json(
      { error: "Yapılmış gezi silinemedi" },
      { status: 500 }
    );
  }
}