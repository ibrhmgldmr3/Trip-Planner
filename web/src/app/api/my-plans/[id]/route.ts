// app/api/plan-detail/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// NextAuth v4 ise:
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

// (Alternatif) NextAuth v5 (app router) kullanıyorsanız:
// import { auth } from "@/auth";

const prisma = new PrismaClient();
// Geliştirme ortamında çoklu instance istemiyorsanız şu kalıbı da kullanabilirsiniz:
// const prisma = globalThis.prisma ?? new PrismaClient();
// if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;
    console.log(`Plan siliniyor: ${planId}`);

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
      select: { user_id: true, city: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
      );
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json(
        { error: "Bu planı silme yetkiniz yok" },
        { status: 403 }
      );
    }

    // Sil
    await prisma.tripPlan.delete({ where: { id: planId } });

    console.log(`Plan başarıyla silindi: ${plan.city}`);

    return NextResponse.json({
      success: true,
      message: "Plan başarıyla silindi",
    });
  } catch (error: unknown) {
    console.error("Plan silme hatası:", error);

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
