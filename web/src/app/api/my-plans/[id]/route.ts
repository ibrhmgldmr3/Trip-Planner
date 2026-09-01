// app/api/plan-detail/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { requireUser } from "@/lib/auth-session";
import { logger } from "@/lib/logger";


export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;

    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    // Plan var mı ve sahibi mi?
    const plan = await prisma.tripPlan.findUnique({
      where: { id: planId },
      select: { userId: true, city: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
      );
    }

    if (plan.userId !== auth.user.id) {
      return NextResponse.json(
        { error: "Bu planı silme yetkiniz yok" },
        { status: 403 }
      );
    }

    // Sil
    await prisma.tripPlan.delete({ where: { id: planId } });

    logger.info("Plan silindi", { planId });

    return NextResponse.json({
      success: true,
      message: "Plan başarıyla silindi",
    });
  } catch (error: unknown) {
    logger.error("Plan silinemedi", error);

    return NextResponse.json(
      { error: "Plan silinemedi" },
      { status: 500 }
    );
  }
}
