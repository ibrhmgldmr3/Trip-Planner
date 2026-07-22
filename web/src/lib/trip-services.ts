import { prisma } from "@/lib/prisma";

export type ExtractedTripData = {
  accommodation?: {
    name: string;
    location?: string;
    checkIn: Date;
    checkOut: Date;
    price: number;
    type?: string;
    amenities?: string[];
    address?: string;
    coordinates?: { lat: number; lng: number };
  }[];
  transportation?: {
    type: string;
    provider?: string;
    departureTime: Date;
    arrivalTime: Date;
    departureLocation: string;
    arrivalLocation: string;
    price: number;
    bookingReference?: string;
    seats?: string;
  }[];
  dailyPlans?: {
    date: Date;
    title?: string;
    activities: {
      time?: string;
      title: string;
      description?: string;
      location?: string;
      cost?: number;
      category?: string;
    }[];
  }[];
  budgetItems?: {
    category: string;
    description: string;
    amount: number;
    date?: Date;
  }[];
};

export async function updateTripWithAiData(
  tripId: string,
  data: ExtractedTripData
) {
  try {
    // Start a transaction for all updates
    return await prisma.$transaction(async (tx) => {
      // 1. Update accommodations if provided
      if (data.accommodation && data.accommodation.length > 0) {
        await Promise.all(
          data.accommodation.map((acc) =>
            tx.accommodation.create({
              data: {
                tripId,
                name: acc.name,
                location: acc.location,
                checkIn: acc.checkIn,
                checkOut: acc.checkOut,
                price: acc.price,
                type: acc.type,
                amenities: acc.amenities ? JSON.stringify(acc.amenities) : undefined,
                address: acc.address,
                coordinates: acc.coordinates || undefined,
              },
            })
          )
        );
      }

      // 2. Update transportation if provided
      if (data.transportation && data.transportation.length > 0) {
        await Promise.all(
          data.transportation.map((trans) =>
            tx.transportation.create({
              data: {
                tripId,
                type: trans.type,
                provider: trans.provider,
                departureTime: trans.departureTime,
                arrivalTime: trans.arrivalTime,
                departureLocation: trans.departureLocation,
                arrivalLocation: trans.arrivalLocation,
                price: trans.price,
                bookingReference: trans.bookingReference,
                seats: trans.seats,
              },
            })
          )
        );
      }

      // 3. Update daily plans if provided
      if (data.dailyPlans && data.dailyPlans.length > 0) {
        await Promise.all(
          data.dailyPlans.map((plan) =>
            tx.dailyPlan.create({
              data: {
                tripId,
                date: plan.date,
                title: plan.title,
                activities: plan.activities || [],
              },
            })
          )
        );
      }

      // 4. Update budget items if provided
      if (data.budgetItems && data.budgetItems.length > 0) {
        await Promise.all(
          data.budgetItems.map((item) =>
            tx.budgetItem.create({
              data: {
                tripId,
                category: item.category,
                description: item.description,
                amount: item.amount,
                date: item.date,
              },
            })
          )
        );
      }

      // 5. Calculate total budget and update trip
      if (data.budgetItems && data.budgetItems.length > 0) {
        const totalBudget = data.budgetItems.reduce(
          (sum, item) => sum + item.amount,
          0
        );

        await tx.trip.update({
          where: { id: tripId },
          data: { budget: totalBudget },
        });
      }

      return { success: true };
    });
  } catch (error) {
    console.error("Error updating trip with AI data:", error);
    throw error;
  }
}

