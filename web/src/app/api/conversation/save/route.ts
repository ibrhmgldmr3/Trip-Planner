import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

    const { tripId, messages, summary, tags } = await req.json();

    // Validate required fields
    if (!tripId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Missing required fields or invalid data format" },
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

    // Create a new conversation
    const conversation = await prisma.aiConversation.create({
      data: {
        tripId,
        messages: messages,
        summary: summary || null,
        tags: tags ? JSON.stringify(tags) : null,
      },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    logger.error("Konuşma kaydedilemedi", error);
    return NextResponse.json(
      { error: "Failed to save conversation" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;

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
        userId: userId,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 }
      );
    }

    // Get all conversations for the trip
    const conversations = await prisma.aiConversation.findMany({
      where: {
        tripId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    logger.error("Konuşmalar getirilemedi", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

