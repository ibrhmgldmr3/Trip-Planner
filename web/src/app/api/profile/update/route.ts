import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for profile update
const profileUpdateSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır").optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  birthDate: z.string().optional(),
  preferredTransport: z.enum(["all", "plane", "bus", "train", "car", "boat"]).optional(),
  preferredCurrency: z.enum(["TRY", "USD", "EUR", "GBP"]).optional(),
  interests: z.string().optional(),
});

interface UserPreferences {
  phone?: string;
  bio?: string;
  location?: string;
  birthDate?: string;
  [key: string]: unknown;
}

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
    
    const { name, phone, bio, location, birthDate, preferredTransport, preferredCurrency, interests } = result.data;

    // Get current user to merge preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true }
    });

    // Parse current preferences
    let currentPreferences: UserPreferences = {};
    if (currentUser?.preferences) {
      try {
        currentPreferences = typeof currentUser.preferences === 'string'
          ? JSON.parse(currentUser.preferences as string)
          : currentUser.preferences as UserPreferences;
      } catch {
        currentPreferences = {};
      }
    }

    // Update preferences with new values
    const updatedPreferences = {
      ...currentPreferences,
      ...(phone !== undefined && { phone }),
      ...(bio !== undefined && { bio }),
      ...(location !== undefined && { location }),
      ...(birthDate !== undefined && { birthDate }),
    };

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(preferredTransport && { preferredTransport }),
        ...(preferredCurrency && { preferredCurrency }),
        ...(interests && { interests }),
        preferences: JSON.stringify(updatedPreferences),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        preferredTransport: true,
        preferredCurrency: true,
        interests: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Add the preferences fields to profile for frontend compatibility
    const profile = {
      ...updatedUser,
      phone: updatedPreferences?.phone || null,
      bio: updatedPreferences?.bio || null,
      location: updatedPreferences?.location || null,
      birthDate: updatedPreferences?.birthDate || null,
    };

    return NextResponse.json(
      { 
        success: true,
        profile: profile,
        message: "Profil başarıyla güncellendi"
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Profil güncellemesi sırasında bir hata oluştu" 
      },
      { status: 500 }
    );
  }
}

