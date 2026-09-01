import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { requireOwnedSubresource } from "@/lib/trip-ownership";
import { logger } from "@/lib/logger";

export async function GET(
  req: NextRequest, 
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    const { id: itemId } = await context.params;

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

    const budgetItem = await prisma.budgetItem.findUnique({
      where: { id: itemId },
    });

    if (!budgetItem) {
      return NextResponse.json(
        { error: "Bütçe kalemi bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      budgetItem: {
        id: budgetItem.id,
        category: budgetItem.category,
        description: budgetItem.description,
        amount: budgetItem.amount,
        currency: budgetItem.currency,
        date: budgetItem.date,
        isEstimate: budgetItem.isEstimate,
        isPaid: budgetItem.isPaid,
        paymentMethod: budgetItem.paymentMethod,
        createdAt: budgetItem.createdAt,
        updatedAt: budgetItem.updatedAt,
        tripId: budgetItem.tripId
      }
    });
  } catch (error) {
    logger.error("Bütçe kalemi getirilemedi", error);
    return NextResponse.json(
      { error: "Failed to fetch budget item" },
      { status: 500 }
    );
  }
}
