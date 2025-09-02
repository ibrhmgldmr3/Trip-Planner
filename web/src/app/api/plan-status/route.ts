import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(request: NextRequest) {
  try {
    console.log("🔄 Plan statüsü güncelleme isteği alındı");
    
    // Session kontrolü
    const session = await getServerSession(authOptions);
    console.log("🔑 Session kontrol edildi:", session ? "Mevcut" : "Yok");
    
    if (!session || !session.user?.email) {
      console.log("❌ Session bulunamadı veya email eksik");
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 });
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

    const { planId, status } = await request.json();
    console.log(`📝 Plan ID: ${planId}, Yeni Statü: ${status}`);

    if (!planId || !status) {
      return NextResponse.json(
        { error: 'Plan ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DONE'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Check if the plan belongs to the current user
    const existingPlan = await prisma.tripPlan.findFirst({
      where: {
        id: planId,
        user_id: user.id,
      },
    });

    console.log(`🔍 Plan arama sonucu:`, {
      planId,
      userId: user.id,
      found: !!existingPlan,
      currentStatus: existingPlan?.status
    });

    if (!existingPlan) {
      console.log(`❌ Plan bulunamadı: planId=${planId}, userId=${user.id}`);
      return NextResponse.json(
        { error: 'Plan not found or unauthorized' },
        { status: 404 }
      );
    }

    // Update the plan status
    console.log(`🔄 Plan statüsü güncelleniyor: ${existingPlan.status} → ${status}`);
    
    const updatedPlan = await prisma.tripPlan.update({
      where: {
        id: planId,
      },
      data: {
        status: status,
      },
    });

    console.log(`✅ Plan statüsü başarıyla güncellendi:`, {
      planId: updatedPlan.id,
      oldStatus: existingPlan.status,
      newStatus: updatedPlan.status
    });

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
    });

  } catch (error) {
    console.error('💥 Plan statüsü güncelleme hatası:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
