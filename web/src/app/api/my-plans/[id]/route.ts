import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";

const prisma = new PrismaClient();

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const planId = params.id;
    console.log(`🗑️ Plan siliniyor: ${planId}`);
    
    // Session kontrolü
    const session = await getServerSession();
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: "Giriş yapmanız gerekiyor" },
        { status: 401 }
      );
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

    // Önce planın varlığını ve kullanıcının sahipliğini kontrol et
    const plan = await prisma.tripPlan.findUnique({
      where: {
        id: planId
      },
      select: {
        user_id: true,
        city: true
      }
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
      );
    }

    // Kullanıcının kendi planı olup olmadığını kontrol et
    if (plan.user_id !== user.id) {
      return NextResponse.json(
        { error: "Bu planı silme yetkiniz yok" },
        { status: 403 }
      );
    }

    // Planı sil
    await prisma.tripPlan.delete({
      where: {
        id: planId
      }
    });

    console.log(`✅ Plan başarıyla silindi: ${plan.city}`);

    return NextResponse.json({
      success: true,
      message: "Plan başarıyla silindi"
    });

  } catch (error: unknown) {
    console.error("💥 Plan silme hatası:", error);
    
    const errorDetails = error instanceof Error 
      ? { 
          name: error.name, 
          message: error.message
        }
      : { 
          unknown: "Bilinmeyen hata tipi",
          value: String(error)
        };
    
    return NextResponse.json(
      { 
        error: "Plan silinemedi",
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
