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

    // Get all transportation for the trip
    const transportations = await prisma.transportation.findMany({
      where: {
        tripId,
      },
      orderBy: {
        departureTime: "asc",
      },
    });

    return NextResponse.json({ transportations });
  } catch (error) {
    console.error("Error fetching transportations:", error);
    return NextResponse.json(
      { error: "Failed to fetch transportations" },
      { status: 500 }
    );
  }
}

