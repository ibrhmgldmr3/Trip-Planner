import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ilkHataMesaji } from "@/lib/api-schemas";
import { requireUser } from "@/lib/auth-session";
import { logger } from "@/lib/logger";

// Schema for profile update
// Uzunluk sınırları şart: bu alanların dördü `preferences` JSON sütununa
// yazılıyor ve sınırsız bırakılırsa tek istekle megabaytlarca veri
// saklanabiliyordu.
const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "İsim en az 2 karakter olmalıdır").max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(120).optional(),
  birthDate: z.string().trim().max(40).optional(),
  preferredTransport: z.enum(["all", "plane", "bus", "train", "car", "boat"]).optional(),
  preferredCurrency: z.enum(["TRY", "USD", "EUR", "GBP"]).optional(),
  interests: z.string().trim().max(500).optional(),
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
    // Kimlik doğrulaması: id'yi session'dan körü körüne almak yerine
    // veritabanından çözüyoruz (bkz. src/lib/auth-session.ts).
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;
    
    // Parse request body
    const body = await request.json();
    
    // Validate request body
    const result = profileUpdateSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(result.error, "Form bilgileri geçersiz") },
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
        // DİKKAT: `Json` sütununa OBJE yazılıyor, JSON.stringify DEĞİL.
        // Eskiden metin yazılıyordu; `GET /api/profile` sütunu obje sanıp
        // `preferences.phone` okuduğu için telefon/bio/konum/doğum tarihi
        // kaydediliyor ama profil sayfasına hiç geri dönmüyordu.
        preferences: updatedPreferences as Prisma.InputJsonValue,
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
    logger.error("Profil güncellenemedi", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Profil güncellemesi sırasında bir hata oluştu" 
      },
      { status: 500 }
    );
  }
}

