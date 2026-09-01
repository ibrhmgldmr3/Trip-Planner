import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth-session";
import { requireOwnedTrip, requireOwnedSubresource } from "@/lib/trip-ownership";
import {
  transportationCreateSchema,
  transportationUpdateSchema,
  ilkHataMesaji,
} from "@/lib/api-schemas";
import { tarihiCoz } from "@/lib/trip-dates";
import { logger } from "@/lib/logger";

/**
 * Seyahatin ulaşım kayıtları.
 *
 * Aşama 1 kapsamında GET-only durumdan tam CRUD'a çıkarıldı. Manuel
 * planlayıcı seçilen ulaşımı bugün `TripPlan.transportation` sütununa JSON
 * METNİ olarak yazıyor; hedef bu tabloya taşımak.
 */

/** Kalkış/varış zamanlarını çözer ve sıralarını doğrular. */
function zamanlariDogrula(
  departureTime: string | undefined,
  arrivalTime: string | undefined,
  mevcut?: { departureTime: Date; arrivalTime: Date }
):
  | { ok: true; departureTime: Date; arrivalTime: Date }
  | { ok: false; hata: string } {
  const kalkis =
    departureTime !== undefined ? tarihiCoz(departureTime) : mevcut?.departureTime;
  const varis =
    arrivalTime !== undefined ? tarihiCoz(arrivalTime) : mevcut?.arrivalTime;

  if (!kalkis || !varis) return { ok: false, hata: "Geçersiz tarih formatı" };

  if (varis < kalkis) {
    return { ok: false, hata: "Varış zamanı kalkış zamanından önce olamaz" };
  }

  return { ok: true, departureTime: kalkis, arrivalTime: varis };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const tripId = new URL(req.url).searchParams.get("tripId");

    const sahiplik = await requireOwnedTrip(tripId, auth.user.id);
    if (!sahiplik.ok) return sahiplik.response;

    const transportations = await prisma.transportation.findMany({
      where: { tripId: sahiplik.trip.id },
      orderBy: { departureTime: "asc" },
    });

    return NextResponse.json({ transportations });
  } catch (error) {
    logger.error("Ulaşım seçenekleri getirilemedi", error);
    return NextResponse.json(
      { error: "Ulaşım seçenekleri getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = transportationCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Ulaşım bilgileri geçersiz") },
        { status: 400 }
      );
    }

    const veri = parsed.data;

    const sahiplik = await requireOwnedTrip(veri.tripId, auth.user.id);
    if (!sahiplik.ok) return sahiplik.response;

    const zamanlar = zamanlariDogrula(veri.departureTime, veri.arrivalTime);
    if (!zamanlar.ok) {
      return NextResponse.json({ error: zamanlar.hata }, { status: 400 });
    }

    const transportation = await prisma.transportation.create({
      data: {
        tripId: sahiplik.trip.id,
        type: veri.type,
        provider: veri.provider ?? null,
        departureTime: zamanlar.departureTime,
        arrivalTime: zamanlar.arrivalTime,
        departureLocation: veri.departureLocation,
        arrivalLocation: veri.arrivalLocation,
        price: veri.price,
        bookingReference: veri.bookingReference ?? null,
        bookingUrl: veri.bookingUrl ?? null,
        seats: veri.seats ?? null,
        notes: veri.notes ?? null,
        status: veri.status ?? "pending",
      },
    });

    logger.info("Ulaşım kaydı oluşturuldu", { transportationId: transportation.id });
    return NextResponse.json({ transportation }, { status: 201 });
  } catch (error) {
    logger.error("Ulaşım kaydı oluşturulamadı", error);
    return NextResponse.json(
      { error: "Ulaşım kaydı oluşturulamadı" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = transportationUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Ulaşım bilgileri geçersiz") },
        { status: 400 }
      );
    }

    const veri = parsed.data;

    const sahiplik = await requireOwnedSubresource(
      prisma.transportation,
      veri.id,
      auth.user.id,
      "Ulaşım kaydı bulunamadı"
    );
    if (!sahiplik.ok) return sahiplik.response;

    const mevcut = await prisma.transportation.findUnique({
      where: { id: veri.id },
      select: { departureTime: true, arrivalTime: true },
    });

    if (!mevcut) {
      return NextResponse.json(
        { error: "Ulaşım kaydı bulunamadı" },
        { status: 404 }
      );
    }

    const zamanlar = zamanlariDogrula(veri.departureTime, veri.arrivalTime, mevcut);
    if (!zamanlar.ok) {
      return NextResponse.json({ error: zamanlar.hata }, { status: 400 });
    }

    const updateData: Prisma.TransportationUpdateInput = {
      departureTime: zamanlar.departureTime,
      arrivalTime: zamanlar.arrivalTime,
    };

    if (veri.type !== undefined) updateData.type = veri.type;
    if (veri.provider !== undefined) updateData.provider = veri.provider;
    if (veri.departureLocation !== undefined) {
      updateData.departureLocation = veri.departureLocation;
    }
    if (veri.arrivalLocation !== undefined) {
      updateData.arrivalLocation = veri.arrivalLocation;
    }
    if (veri.price !== undefined) updateData.price = veri.price;
    if (veri.bookingReference !== undefined) {
      updateData.bookingReference = veri.bookingReference;
    }
    if (veri.bookingUrl !== undefined) updateData.bookingUrl = veri.bookingUrl;
    if (veri.seats !== undefined) updateData.seats = veri.seats;
    if (veri.notes !== undefined) updateData.notes = veri.notes;
    if (veri.status !== undefined) updateData.status = veri.status;

    const transportation = await prisma.transportation.update({
      where: { id: veri.id },
      data: updateData,
    });

    logger.info("Ulaşım kaydı güncellendi", { transportationId: veri.id });
    return NextResponse.json({ transportation });
  } catch (error) {
    logger.error("Ulaşım kaydı güncellenemedi", error);
    return NextResponse.json(
      { error: "Ulaşım kaydı güncellenemedi" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const id = new URL(request.url).searchParams.get("id");

    const sahiplik = await requireOwnedSubresource(
      prisma.transportation,
      id,
      auth.user.id,
      "Ulaşım kaydı bulunamadı"
    );
    if (!sahiplik.ok) return sahiplik.response;

    await prisma.transportation.delete({ where: { id: id as string } });

    logger.info("Ulaşım kaydı silindi", { transportationId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Ulaşım kaydı silinemedi", error);
    return NextResponse.json(
      { error: "Ulaşım kaydı silinemedi" },
      { status: 500 }
    );
  }
}
