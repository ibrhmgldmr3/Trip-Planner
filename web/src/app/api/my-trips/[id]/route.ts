import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { logger } from "@/lib/logger";


export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: tripId } = await context.params;
    
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
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    // Trip'i bul (Trip tablosundan, sadece DONE olanları)
    const trip = await prisma.trip.findUnique({
      where: { 
        id: tripId,
        userId: user.id,
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
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    // Trip var mı ve sahibi mi? (Trip tablosundan, sadece DONE olanları)
    const trip = await prisma.trip.findUnique({
      where: { 
        id: tripId,
        userId: user.id,
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