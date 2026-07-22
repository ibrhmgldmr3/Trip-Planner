// app/api/plan-detail/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// NextAuth v4 ise:
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { logger } from "@/lib/logger";

// (Alternatif) NextAuth v5 (app router) kullanıyorsanız:
// import { auth } from "@/auth";


export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;

    // Session kontrolü
    // NextAuth v4:
    const session = await getServerSession(authOptions);

    // NextAuth v5 kullanıyorsanız yukarıdakini kaldırıp şu satırı kullanın:
    // const session = await auth();

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

    if (plan.userId !== user.id) {
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

    const errorDetails =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { unknown: "Bilinmeyen hata tipi", value: String(error) };

    return NextResponse.json(
      { error: "Plan silinemedi", details: errorDetails },
      { status: 500 }
    );
  }
}
