import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth-session";
import { requireOwnedTrip, requireOwnedSubresource } from "@/lib/trip-ownership";
import {
  dailyPlanCreateSchema,
  dailyPlanUpdateSchema,
  ilkHataMesaji,
} from "@/lib/api-schemas";
import { tarihiCoz, gunBasi } from "@/lib/trip-dates";
import { logger } from "@/lib/logger";

/**
 * Seyahatin günlük planları.
 *
 * Bu dosya Aşama 1 kapsamında GET-only durumdan tam CRUD'a çıkarıldı.
 * Amaç `TripPlan.gun_plani` JSON metnini bu tabloyla değiştirmek: JSON
 * sütununda her düzenleme tüm sütunu yeniden yazıyor, iki kullanıcı aynı
 * planı düzenlerse biri diğerini eziyor ve SQL ile toplama yapılamıyordu.
 *
 * Bir seyahatte bir tarih için EN FAZLA BİR günlük plan olur. Şemada
 * `@@unique([tripId, date])` kısıtı var; burada da aynı kural uygulanıyor ki
 * hata Prisma'dan değil, anlamlı bir 409 olarak dönsün.
 */

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const tripId = url.searchParams.get("tripId");
    const date = url.searchParams.get("date");

    const sahiplik = await requireOwnedTrip(tripId, auth.user.id);
    if (!sahiplik.ok) return sahiplik.response;

    const whereCondition: { tripId: string; date?: { gte: Date; lte: Date } } = {
      tripId: sahiplik.trip.id,
    };

    if (date) {
      const gun = tarihiCoz(date);
      if (!gun) {
        return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
      }

      const baslangic = gunBasi(gun);
      const bitis = new Date(baslangic);
      bitis.setHours(23, 59, 59, 999);

      whereCondition.date = { gte: baslangic, lte: bitis };
    }

    const dailyPlans = await prisma.dailyPlan.findMany({
      where: whereCondition,
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ dailyPlans });
  } catch (error) {
    logger.error("Günlük planlar getirilemedi", error);
    return NextResponse.json(
      { error: "Günlük planlar getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = dailyPlanCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Günlük plan geçersiz") },
        { status: 400 }
      );
    }

    const { tripId, date, title, notes, activities } = parsed.data;

    const sahiplik = await requireOwnedTrip(tripId, auth.user.id);
    if (!sahiplik.ok) return sahiplik.response;

    const gun = tarihiCoz(date);
    if (!gun) {
      return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
    }

    // Tarih seyahat aralığının dışına düşmesin: dışarıdaki bir gün hiçbir
    // ekranda görünmüyor ama toplamları etkiliyordu.
    const araligiDisinda =
      gunBasi(gun) < gunBasi(sahiplik.trip.startDate) ||
      gunBasi(gun) > gunBasi(sahiplik.trip.endDate);

    if (araligiDisinda) {
      return NextResponse.json(
        { error: "Tarih seyahat aralığının dışında" },
        { status: 400 }
      );
    }

    try {
      const dailyPlan = await prisma.dailyPlan.create({
        data: {
          tripId: sahiplik.trip.id,
          date: gunBasi(gun),
          title: title ?? null,
          notes: notes ?? null,
          activities: activities as unknown as Prisma.InputJsonValue,
        },
      });

      logger.info("Günlük plan oluşturuldu", { dailyPlanId: dailyPlan.id });
      return NextResponse.json({ dailyPlan }, { status: 201 });
    } catch (createError) {
      if (
        createError instanceof Prisma.PrismaClientKnownRequestError &&
        createError.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Bu tarih için zaten bir günlük plan var" },
          { status: 409 }
        );
      }
      throw createError;
    }
  } catch (error) {
    logger.error("Günlük plan oluşturulamadı", error);
    return NextResponse.json(
      { error: "Günlük plan oluşturulamadı" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = dailyPlanUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Günlük plan geçersiz") },
        { status: 400 }
      );
    }

    const { id, date, title, notes, activities } = parsed.data;

    const sahiplik = await requireOwnedSubresource(
      prisma.dailyPlan,
      id,
      auth.user.id,
      "Günlük plan bulunamadı"
    );
    if (!sahiplik.ok) return sahiplik.response;

    const updateData: Prisma.DailyPlanUpdateInput = {};

    if (date !== undefined) {
      const gun = tarihiCoz(date);
      if (!gun) {
        return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
      }
      updateData.date = gunBasi(gun);
    }

    if (title !== undefined) updateData.title = title;
    if (notes !== undefined) updateData.notes = notes;
    if (activities !== undefined) {
      updateData.activities = activities as unknown as Prisma.InputJsonValue;
    }

    const dailyPlan = await prisma.dailyPlan.update({
      where: { id },
      data: updateData,
    });

    logger.info("Günlük plan güncellendi", { dailyPlanId: id });
    return NextResponse.json({ dailyPlan });
  } catch (error) {
    logger.error("Günlük plan güncellenemedi", error);
    return NextResponse.json(
      { error: "Günlük plan güncellenemedi" },
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
      prisma.dailyPlan,
      id,
      auth.user.id,
      "Günlük plan bulunamadı"
    );
    if (!sahiplik.ok) return sahiplik.response;

    await prisma.dailyPlan.delete({ where: { id: id as string } });

    logger.info("Günlük plan silindi", { dailyPlanId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Günlük plan silinemedi", error);
    return NextResponse.json(
      { error: "Günlük plan silinemedi" },
      { status: 500 }
    );
  }
}
