import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export async function GET(
  req: NextRequest, 
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: itemId } = await context.params;

    if (!itemId) {
      return NextResponse.json(
        { error: "Budget item ID is required" },
        { status: 400 }
      );
    }

    // Fetch the budget item with its trip to verify ownership
    const budgetItem = await prisma.budgetItem.findUnique({
      where: { id: itemId },
      include: { trip: true }
    });

    if (!budgetItem) {
      return NextResponse.json(
        { error: "Budget item not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (budgetItem.trip.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to access this item" },
        { status: 403 }
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
    console.error("Error fetching budget item:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget item" },
      { status: 500 }
    );
  }
}
