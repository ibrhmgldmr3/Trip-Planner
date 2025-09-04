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
    const date = url.searchParams.get("date");

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
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 }
      );
    }

    // Query conditions for daily plans
    const whereCondition: { tripId: string; date?: { gte: Date; lte: Date } } = { tripId };
    
    // If date is provided, filter by date
    if (date) {
      const queryDate = new Date(date);
      
      // Set to start of day
      queryDate.setHours(0, 0, 0, 0);
      
      // Create end of day date
      const endOfDay = new Date(queryDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      whereCondition.date = {
        gte: queryDate,
        lte: endOfDay,
      };
    }

    // Get daily plans for the trip
    const dailyPlans = await prisma.dailyPlan.findMany({
      where: whereCondition,
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json({ dailyPlans });
  } catch (error) {
    console.error("Error fetching daily plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily plans" },
      { status: 500 }
    );
  }
}

