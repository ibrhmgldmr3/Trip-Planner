import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { requireOwnedTrip, requireOwnedSubresource } from "@/lib/trip-ownership";
import {
  budgetItemCreateSchema,
  budgetItemUpdateSchema,
  ilkHataMesaji,
} from "@/lib/api-schemas";
import { tarihiCoz } from "@/lib/trip-dates";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    const url = new URL(req.url);
    const tripId = url.searchParams.get("tripId");
    const category = url.searchParams.get("category");

    const sahiplik = await requireOwnedTrip(tripId, userId);
    if (!sahiplik.ok) return sahiplik.response;

    const whereCondition = category
      ? { tripId: sahiplik.trip.id, category }
      : { tripId: sahiplik.trip.id };

    // Get budget items for the trip
    const budgetItems = await prisma.budgetItem.findMany({
      where: whereCondition,
      orderBy: [
        { category: "asc" },
        { date: "asc" },
      ],
    });

    // Calculate total budget
    const totalBudget = budgetItems.reduce((sum, item) => sum + item.amount, 0);
    
    // Calculate budget by category
    const budgetByCategory = budgetItems.reduce((acc: Record<string, number>, item) => {
      const category = item.category;
      acc[category] = (acc[category] || 0) + item.amount;
      return acc;
    }, {});

    return NextResponse.json({ 
      budgetItems, 
      totalBudget,
      budgetByCategory,
    });
  } catch (error) {
    logger.error("Bütçe getirilemedi", error);
    return NextResponse.json(
      { error: "Failed to fetch budget" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    // Eskiden `amount` hiç doğrulanmıyordu: metin gönderildiğinde Prisma
    // tip hatası fırlatıyor ve uç 500 dönüyordu.
    const parsed = budgetItemCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Bütçe kalemi geçersiz") },
        { status: 400 }
      );
    }

    const { tripId, category, description, amount, date, isEstimate, isPaid } = parsed.data;

    const sahiplik = await requireOwnedTrip(tripId, userId);
    if (!sahiplik.ok) return sahiplik.response;

    // Create new budget item
    const budgetItem = await prisma.budgetItem.create({
      data: {
        tripId: sahiplik.trip.id,
        category,
        description,
        amount,
        date: date ? tarihiCoz(date) : null,
        isEstimate: isEstimate ?? true,
        isPaid: isPaid ?? false,
      },
    });

    return NextResponse.json({ budgetItem });
  } catch (error) {
    logger.error("Bütçe kalemi oluşturulamadı", error);
    return NextResponse.json(
      { error: "Failed to create budget item" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    const parsed = budgetItemUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Bütçe kalemi geçersiz") },
        { status: 400 }
      );
    }

    const { id, category, description, amount, date, isEstimate, isPaid } = parsed.data;

    // Sahiplik alt kayıt yardımcısıyla: kalem -> seyahat -> kullanıcı.
    // Eskiden `include: { trip: true }` ile elle kontrol ediliyordu ve
    // "yok" (404) ile "senin değil" (403) ayrımı yapılıyordu. İlişkisel
    // modelin tamamı artık tek kural uyguluyor: ikisi de 404, çünkü 403
    // id'yi bilen birine o kaydın var olduğunu doğrular.
    const sahiplik = await requireOwnedSubresource(
      prisma.budgetItem,
      id,
      userId,
      "Bütçe kalemi bulunamadı"
    );
    if (!sahiplik.ok) return sahiplik.response;

    const existingItem = await prisma.budgetItem.findUnique({ where: { id } });
    if (!existingItem) {
      return NextResponse.json(
        { error: "Bütçe kalemi bulunamadı" },
        { status: 404 }
      );
    }

    // Update the budget item
    const updatedItem = await prisma.budgetItem.update({
      where: { id },
      data: {
        category: category ?? existingItem.category,
        description: description ?? existingItem.description,
        amount: amount ?? existingItem.amount,
        date: date ? tarihiCoz(date) : existingItem.date,
        isEstimate: isEstimate ?? existingItem.isEstimate,
        isPaid: isPaid ?? existingItem.isPaid,
      },
    });

    return NextResponse.json({ budgetItem: updatedItem });
  } catch (error) {
    logger.error("Bütçe kalemi güncellenemedi", error);
    return NextResponse.json(
      { error: "Failed to update budget item" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    // Get the itemId from query parameters
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json(
        { error: "Budget item ID is required" },
        { status: 400 }
      );
    }

    const sahiplik = await requireOwnedSubresource(
      prisma.budgetItem,
      itemId,
      userId,
      "Bütçe kalemi bulunamadı"
    );
    if (!sahiplik.ok) return sahiplik.response;

    // Delete the budget item
    await prisma.budgetItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Bütçe kalemi silinemedi", error);
    return NextResponse.json(
      { error: "Failed to delete budget item" },
      { status: 500 }
    );
  }
}

