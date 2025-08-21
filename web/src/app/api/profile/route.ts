import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: "Bu işlem için giriş yapmalısınız" },
        { status: 401 }
      );
    }

    // Get user id from session
    const userId = session.user.id;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferredTransport: true,
        preferredCurrency: true,
        interests: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Profil bilgileri alınırken bir hata oluştu" },
      { status: 500 }
    );
  }
}
