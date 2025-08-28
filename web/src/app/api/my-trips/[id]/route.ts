import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

const prisma = new PrismaClient();

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

    // Trip'i bul
    const trip = await prisma.tripPlan.findUnique({
      where: { 
        id: tripId,
        user_id: user.id 
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Yapılmış geziler bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      trip: trip,
    });
  } catch (error: unknown) {
    console.error("Trip detail fetch hatası:", error);
    
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

    // Trip var mı ve sahibi mi?
    const trip = await prisma.tripPlan.findUnique({
      where: { 
        id: tripId,
        user_id: user.id 
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Yapılmış gezi bulunamadı" },
        { status: 404 }
      );
    }

    // Sil
    await prisma.tripPlan.delete({ where: { id: tripId } });

    return NextResponse.json({
      success: true,
      message: "Yapılmış gezi başarıyla silindi",
    });
  } catch (error: unknown) {
    console.error("Trip delete hatası:", error);
    
    return NextResponse.json(
      { error: "Yapılmış gezi silinemedi" },
      { status: 500 }
    );
  }
}