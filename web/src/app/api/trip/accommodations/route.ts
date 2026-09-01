import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth-session";
import { requireOwnedTrip, requireOwnedSubresource } from "@/lib/trip-ownership";
import {
  accommodationCreateSchema,
  accommodationUpdateSchema,
  ilkHataMesaji,
} from "@/lib/api-schemas";
import { tarihiCoz } from "@/lib/trip-dates";
import { logger } from "@/lib/logger";

/**
 * Seyahatin konaklama kayıtları.
 *
 * Aşama 1 kapsamında GET-only durumdan tam CRUD'a çıkarıldı. Manuel
 * planlayıcı bugün seçilen oteli `TripPlan.accommodation` sütununa JSON
 * METNİ olarak yazıyor; hedef bu tabloya taşımak.
 */

/** Giriş/çıkış tarihlerini çözer ve tutarlılığını doğrular. */
function tarihleriDogrula(
  checkIn: string | undefined,
  checkOut: string | undefined,
  mevcut?: { checkIn: Date; checkOut: Date }
):
  | { ok: true; checkIn: Date; checkOut: Date }
  | { ok: false; hata: string } {
  const giris = checkIn !== undefined ? tarihiCoz(checkIn) : mevcut?.checkIn;
  const cikis = checkOut !== undefined ? tarihiCoz(checkOut) : mevcut?.checkOut;

  if (!giris || !cikis) return { ok: false, hata: "Geçersiz tarih formatı" };

  // Aynı gün giriş-çıkış (günübirlik) kabul; ters aralık değil.
  if (cikis < giris) {
    return { ok: false, hata: "Çıkış tarihi giriş tarihinden önce olamaz" };
  }

  return { ok: true, checkIn: giris, checkOut: cikis };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const tripId = new URL(req.url).searchParams.get("tripId");

    const sahiplik = await requireOwnedTrip(tripId, auth.user.id);
    if (!sahiplik.ok) return sahiplik.response;

    const accommodations = await prisma.accommodation.findMany({
      where: { tripId: sahiplik.trip.id },
      orderBy: { checkIn: "asc" },
    });

    return NextResponse.json({ accommodations });
  } catch (error) {
    logger.error("Konaklamalar getirilemedi", error);
    return NextResponse.json(
      { error: "Konaklamalar getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = accommodationCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Konaklama bilgileri geçersiz") },
        { status: 400 }
      );
    }

    const veri = parsed.data;

    const sahiplik = await requireOwnedTrip(veri.tripId, auth.user.id);
    if (!sahiplik.ok) return sahiplik.response;

    const tarihler = tarihleriDogrula(veri.checkIn, veri.checkOut);
    if (!tarihler.ok) {
      return NextResponse.json({ error: tarihler.hata }, { status: 400 });
    }

    const accommodation = await prisma.accommodation.create({
      data: {
        tripId: sahiplik.trip.id,
        name: veri.name,
        location: veri.location ?? null,
        checkIn: tarihler.checkIn,
        checkOut: tarihler.checkOut,
        price: veri.price,
        priceUnit: veri.priceUnit ?? "total",
        bookingUrl: veri.bookingUrl ?? null,
        type: veri.type ?? null,
        // `amenities` sütunu String; dizi JSON olarak saklanıyor.
        amenities: veri.amenities ? JSON.stringify(veri.amenities) : null,
        address: veri.address ?? null,
        coordinates: veri.coordinates
          ? (veri.coordinates as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        rating: veri.rating ?? null,
        notes: veri.notes ?? null,
        status: veri.status ?? "pending",
        confirmation: veri.confirmation ?? null,
      },
    });

    logger.info("Konaklama oluşturuldu", { accommodationId: accommodation.id });
    return NextResponse.json({ accommodation }, { status: 201 });
  } catch (error) {
    logger.error("Konaklama oluşturulamadı", error);
    return NextResponse.json(
      { error: "Konaklama oluşturulamadı" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = accommodationUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Konaklama bilgileri geçersiz") },
        { status: 400 }
      );
    }

    const veri = parsed.data;

    const sahiplik = await requireOwnedSubresource(
      prisma.accommodation,
      veri.id,
      auth.user.id,
      "Konaklama bulunamadı"
    );
    if (!sahiplik.ok) return sahiplik.response;

    const mevcut = await prisma.accommodation.findUnique({
      where: { id: veri.id },
      select: { checkIn: true, checkOut: true },
    });

    if (!mevcut) {
      return NextResponse.json({ error: "Konaklama bulunamadı" }, { status: 404 });
    }

    // Tarihlerden yalnızca biri gönderilse bile aralık tutarlı kalmalı;
    // eksik olan taraf kayıttaki değerden alınıyor.
    const tarihler = tarihleriDogrula(veri.checkIn, veri.checkOut, mevcut);
    if (!tarihler.ok) {
      return NextResponse.json({ error: tarihler.hata }, { status: 400 });
    }

    const updateData: Prisma.AccommodationUpdateInput = {
      checkIn: tarihler.checkIn,
      checkOut: tarihler.checkOut,
    };

    if (veri.name !== undefined) updateData.name = veri.name;
    if (veri.location !== undefined) updateData.location = veri.location;
    if (veri.price !== undefined) updateData.price = veri.price;
    if (veri.priceUnit !== undefined) updateData.priceUnit = veri.priceUnit;
    if (veri.bookingUrl !== undefined) updateData.bookingUrl = veri.bookingUrl;
    if (veri.type !== undefined) updateData.type = veri.type;
    if (veri.amenities !== undefined) {
      updateData.amenities = JSON.stringify(veri.amenities);
    }
    if (veri.address !== undefined) updateData.address = veri.address;
    if (veri.coordinates !== undefined) {
      updateData.coordinates = veri.coordinates as unknown as Prisma.InputJsonValue;
    }
    if (veri.rating !== undefined) updateData.rating = veri.rating;
    if (veri.notes !== undefined) updateData.notes = veri.notes;
    if (veri.status !== undefined) updateData.status = veri.status;
    if (veri.confirmation !== undefined) updateData.confirmation = veri.confirmation;

    const accommodation = await prisma.accommodation.update({
      where: { id: veri.id },
      data: updateData,
    });

    logger.info("Konaklama güncellendi", { accommodationId: veri.id });
    return NextResponse.json({ accommodation });
  } catch (error) {
    logger.error("Konaklama güncellenemedi", error);
    return NextResponse.json(
      { error: "Konaklama güncellenemedi" },
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
      prisma.accommodation,
      id,
      auth.user.id,
      "Konaklama bulunamadı"
    );
    if (!sahiplik.ok) return sahiplik.response;

    await prisma.accommodation.delete({ where: { id: id as string } });

    logger.info("Konaklama silindi", { accommodationId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Konaklama silinemedi", error);
    return NextResponse.json(
      { error: "Konaklama silinemedi" },
      { status: 500 }
    );
  }
}
