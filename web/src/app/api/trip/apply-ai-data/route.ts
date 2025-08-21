import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { updateTripWithAiData } from "@/lib/trip-services";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tripId, extractedData } = await req.json();

    if (!tripId || !extractedData) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // Update trip with extracted data
    await updateTripWithAiData(tripId, extractedData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error applying AI data to trip:", error);
    return NextResponse.json(
      { error: "Failed to apply AI data to trip" },
      { status: 500 }
    );
  }
}
