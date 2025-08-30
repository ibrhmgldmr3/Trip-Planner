import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { TripStatus } from '@prisma/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await request.json();
    
    if (!Object.values(TripStatus).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const tripPlan = await prisma.tripPlan.findFirst({
      where: {
        id: id,
        userEmail: session.user.email
      }
    });

    if (!tripPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const updatedPlan = await prisma.tripPlan.update({
      where: { id: id },
      data: { 
        status,
        completedAt: status === TripStatus.DONE ? new Date() : null
      }
    });

    // Eğer DONE olarak işaretlendiyse, Trip tablosuna da ekle
    if (status === TripStatus.DONE && !tripPlan.tripId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email }
      });

      if (user) {
        const trip = await prisma.trip.create({
          data: {
            title: `${tripPlan.city} Gezisi`,
            description: tripPlan.sehir_bilgisi || '',
            startDate: tripPlan.startDate || new Date(),
            endDate: tripPlan.endDate || new Date(),
            userId: user.id,
            city: tripPlan.city,
            country: tripPlan.country || '',
            budget: tripPlan.total_cost,
            status: TripStatus.DONE
          }
        });

        // TripPlan'ı Trip'e bağla
        await prisma.tripPlan.update({
          where: { id: id },
          data: { tripId: trip.id }
        });
      }
    }

    return NextResponse.json(updatedPlan);
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
