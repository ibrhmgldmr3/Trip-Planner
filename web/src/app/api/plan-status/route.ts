import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";


export async function PUT(request: NextRequest) {
  try {
    // Session kontrolü
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
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
        userId: user.id,
      },
    });

    if (!existingPlan) {
      // Yetkisiz erişim denemesi olabilir; güvenlik açısından iz bırakıyoruz.
      logger.warn("Plan bulunamadı veya yetkisiz erişim", undefined, {
        planId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Plan not found or unauthorized' },
        { status: 404 }
      );
    }

    // Update the plan status
    const updatedPlan = await prisma.tripPlan.update({
      where: {
        id: planId,
      },
      data: {
        status: status,
      },
    });

    logger.info("Plan statüsü güncellendi", {
      planId: updatedPlan.id,
      oldStatus: existingPlan.status,
      newStatus: updatedPlan.status
    });

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
    });

  } catch (error) {
    logger.error("Plan statüsü güncellenemedi", error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

