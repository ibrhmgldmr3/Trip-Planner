import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        userId: session.user.id as string,
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
    console.error("Error saving conversation:", error);
    return NextResponse.json(
      { error: "Failed to save conversation" },
      { status: 500 }
    );
  }
}

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
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
