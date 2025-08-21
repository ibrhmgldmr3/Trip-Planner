import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for profile update
const profileUpdateSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır").optional(),
  preferredTransport: z.enum(["all", "plane", "bus", "train", "car"]).optional(),
  preferredCurrency: z.enum(["TRY", "USD", "EUR", "GBP"]).optional(),
  interests: z.array(z.string()).optional(),
});

export async function PUT(request: Request) {
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
    
    // Parse request body
    const body = await request.json();
    
    // Validate request body
    const result = profileUpdateSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.format()._errors[0] || "Form validation failed" },
        { status: 400 }
      );
    }
    
    const { name, preferredTransport, preferredCurrency, interests } = result.data;

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(preferredTransport && { preferredTransport }),
        ...(preferredCurrency && { preferredCurrency }),
        ...(interests && { interests: JSON.stringify(interests) }),
      },
    });

    // Remove sensitive data from response
    const userWithoutPassword = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      preferredTransport: updatedUser.preferredTransport,
      preferredCurrency: updatedUser.preferredCurrency,
      interests: updatedUser.interests,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    return NextResponse.json(
      { 
        user: userWithoutPassword,
        message: "Profil başarıyla güncellendi"
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Profil güncellemesi sırasında bir hata oluştu" },
      { status: 500 }
    );
  }
}
