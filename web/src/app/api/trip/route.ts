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
    const id = url.searchParams.get("id");

    // If ID is provided, fetch a specific trip
    if (id) {
      const trip = await prisma.trip.findUnique({
        where: {
          id,
          userId: session.user.id as string,
        },
        include: {
          activities: true,
          accommodations: true,
          transportations: true,
          dailyPlans: true,
          budgetItems: true,
        },
      });

      if (!trip) {
        return NextResponse.json(
          { error: "Trip not found or access denied" },
          { status: 404 }
        );
      }

      return NextResponse.json({ trip });
    }

    // Otherwise fetch all trips for the user
    const trips = await prisma.trip.findMany({
      where: {
        userId: session.user.id as string,
      },
      orderBy: {
        startDate: 'desc',
      },
      include: {
        _count: {
          select: {
            activities: true,
            accommodations: true,
            transportations: true,
            dailyPlans: true,
            budgetItems: true,
          },
        },
      },
    });

    return NextResponse.json({ trips });
  } catch (error) {
    console.error("Error fetching trips:", error);
    return NextResponse.json(
      { error: "Failed to fetch trips" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { title, description, startDate, endDate, city, country, budget } = data;

    // Validate required fields
    if (!title || !startDate || !endDate || !city) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create new trip
    const trip = await prisma.trip.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        city,
        country,
        budget: budget ? parseFloat(budget) : null,
        userId: session.user.id as string,
      },
    });

    return NextResponse.json({ trip });
  } catch (error) {
    console.error("Error creating trip:", error);
    return NextResponse.json(
      { error: "Failed to create trip" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { id, title, description, startDate, endDate, city, country, budget, status } = data;

    if (!id) {
      return NextResponse.json(
        { error: "Trip ID is required" },
        { status: 400 }
      );
    }

    // Check if trip exists and belongs to the user
    const existingTrip = await prisma.trip.findUnique({
      where: {
        id,
        userId: session.user.id as string,
      },
    });

    if (!existingTrip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 }
      );
    }

    // Update trip
    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        title: title ?? existingTrip.title,
        description: description ?? existingTrip.description,
        startDate: startDate ? new Date(startDate) : existingTrip.startDate,
        endDate: endDate ? new Date(endDate) : existingTrip.endDate,
        city: city ?? existingTrip.city,
        country: country ?? existingTrip.country,
        budget: budget !== undefined ? parseFloat(budget) : existingTrip.budget,
        status: status ?? existingTrip.status,
      },
    });

    return NextResponse.json({ trip: updatedTrip });
  } catch (error) {
    console.error("Error updating trip:", error);
    return NextResponse.json(
      { error: "Failed to update trip" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Trip ID is required" },
        { status: 400 }
      );
    }

    // Check if trip exists and belongs to the user
    const existingTrip = await prisma.trip.findUnique({
      where: {
        id,
        userId: session.user.id as string,
      },
    });

    if (!existingTrip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 }
      );
    }

    // Delete trip
    await prisma.trip.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting trip:", error);
    return NextResponse.json(
      { error: "Failed to delete trip" },
      { status: 500 }
    );
  }
}

