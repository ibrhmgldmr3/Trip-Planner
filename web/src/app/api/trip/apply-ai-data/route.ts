import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { updateTripWithAiData } from "@/lib/trip-services";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

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
        userId: userId,
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
    logger.error("AI verisi seyahate uygulanamadı", error);
    return NextResponse.json(
      { error: "Failed to apply AI data to trip" },
      { status: 500 }
    );
  }
}

