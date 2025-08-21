import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const tripId = url.searchParams.get("tripId");
    const category = url.searchParams.get("category");

    if (!tripId) {
      return NextResponse.json(
        { error: "Trip ID is required" },
        { status: 400 }
      );
    }

    // Check if trip exists and belongs to the user
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: session.user.id as string,
      },
      include: {
        budgetItems: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 }
      );
    }

    // Query conditions for budget items
    const whereCondition: { tripId: string; category?: string } = { tripId };

    // If category is provided, filter by category
    if (category) {
      whereCondition.category = category;
    }

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
    console.error("Error fetching budget:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // User must be authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be logged in to create budget items" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { tripId, category, description, amount, date, isEstimate, isPaid } = data;

    if (!tripId || !category || !description || amount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify trip ownership
    const trip = await prisma.trip.findUnique({
      where: {
        id: tripId,
        userId: session.user.id as string,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found or you don't have access" },
        { status: 404 }
      );
    }

    // Create new budget item
    const budgetItem = await prisma.budgetItem.create({
      data: {
        tripId,
        category,
        description,
        amount,
        date: date ? new Date(date) : null,
        isEstimate: isEstimate ?? false,
        isPaid: isPaid ?? false,
      },
    });

    return NextResponse.json({ budgetItem });
  } catch (error) {
    console.error("Error creating budget item:", error);
    return NextResponse.json(
      { error: "Failed to create budget item" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // User must be authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be logged in to update budget items" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { id, category, description, amount, date, isEstimate, isPaid } = data;

    if (!id) {
      return NextResponse.json(
        { error: "Budget item ID is required" },
        { status: 400 }
      );
    }

    // Get the budget item
    const existingItem = await prisma.budgetItem.findUnique({
      where: { id },
      include: { trip: true },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Budget item not found" },
        { status: 404 }
      );
    }

    // Verify ownership through the trip
    if (existingItem.trip.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to update this item" },
        { status: 403 }
      );
    }

    // Update the budget item
    const updatedItem = await prisma.budgetItem.update({
      where: { id },
      data: {
        category: category ?? existingItem.category,
        description: description ?? existingItem.description,
        amount: amount ?? existingItem.amount,
        date: date ? new Date(date) : existingItem.date,
        isEstimate: isEstimate ?? existingItem.isEstimate,
        isPaid: isPaid ?? existingItem.isPaid,
      },
    });

    return NextResponse.json({ budgetItem: updatedItem });
  } catch (error) {
    console.error("Error updating budget item:", error);
    return NextResponse.json(
      { error: "Failed to update budget item" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // User must be authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be logged in to delete budget items" },
        { status: 401 }
      );
    }

    // Get the itemId from query parameters
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json(
        { error: "Budget item ID is required" },
        { status: 400 }
      );
    }

    // Get the budget item
    const existingItem = await prisma.budgetItem.findUnique({
      where: { id: itemId },
      include: { trip: true },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Budget item not found" },
        { status: 404 }
      );
    }

    // Verify ownership through the trip
    if (existingItem.trip.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete this item" },
        { status: 403 }
      );
    }

    // Delete the budget item
    await prisma.budgetItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting budget item:", error);
    return NextResponse.json(
      { error: "Failed to delete budget item" },
      { status: 500 }
    );
  }
}
