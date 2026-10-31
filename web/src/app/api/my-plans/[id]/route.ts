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

    // Sahiplik sorgunun içinde; "yok" ile "senin değil" ayrımı YAPILMIYOR.
    // Ayrım, id'yi bilen birine o planın var olduğunu doğrular — ilişkisel
    // model uçları (src/lib/trip-ownership.ts) bu kuralı zaten uyguluyor.
    const plan = await prisma.tripPlan.findFirst({
      where: { id: planId, userId: auth.user.id },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
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
