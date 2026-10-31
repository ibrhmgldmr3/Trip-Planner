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
import { tarihiCoz, gunBasi, utcGunBasi } from "@/lib/trip-dates";
import { logger } from "@/lib/logger";
import { aktiviteButcesiniEsitle, toplamOzeti } from "@/lib/iliskisel-plan-ozeti";

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
 *
 * HER YAZMA BÜTÇEYİ DE EŞİTLİYOR (B4 · Adım 5). Aktivite maliyetleri
 * bütçenin "aktiviteler" kategorisine yansıtılıyor. Bu kural JSON modelinde
 * `PUT /api/plan-detail/[id]` içinde yaşıyordu ve günlük planlayıcı taşınmış
 * planlarda o ucu bir de ONUN İÇİN çağırıyordu (geçiş dönemi çift yazması).
 * Çift yazma kaldırıldı; kural yazmanın gerçekleştiği yere, buraya geldi.
 * Aksi halde eklenen bir aktivitenin maliyeti hiçbir toplamda görünmezdi.
 */

/**
 * Gün planı değiştikten sonra bütçeyi eşitler ve yeni toplamı döndürür.
 *
 * Yanıtta dönmesinin sebebi: günlük planlayıcı toplamı ekranda anında
 * gösteriyor. Dönmeseydi istemci ya toplamı kendi hesaplardı (aktivite dışı
 * kalemleri göremediği için YANLIŞ çıkardı) ya da her kaydetmeden sonra
 * fazladan bir okuma yapardı.
 */
async function gunlerDegistiginde(trip: { id: string; startDate: Date; endDate: Date }) {
  const toplam = await aktiviteButcesiniEsitle(trip.id);
  return toplamOzeti(toplam, trip.startDate, trip.endDate);
}

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

      // `date` bir `@db.Date` sütunu: değerler UTC gece yarısında duruyor.
      // Yerel gün başıyla filtrelemek GMT+3'te bir gün kaydırıyordu.
      const baslangic = utcGunBasi(gun);
      const bitis = new Date(baslangic);
      bitis.setUTCHours(23, 59, 59, 999);

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
          date: utcGunBasi(gun),
          title: title ?? null,
          notes: notes ?? null,
          activities: activities as unknown as Prisma.InputJsonValue,
        },
      });

      logger.info("Günlük plan oluşturuldu", { dailyPlanId: dailyPlan.id });

      return NextResponse.json(
        { dailyPlan, ozet: await gunlerDegistiginde(sahiplik.trip) },
        { status: 201 }
      );
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
      updateData.date = utcGunBasi(gun);
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

    return NextResponse.json({
      dailyPlan,
      ozet: await gunlerDegistiginde(sahiplik.trip),
    });
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

    return NextResponse.json({
      success: true,
      ozet: await gunlerDegistiginde(sahiplik.trip),
    });
  } catch (error) {
    logger.error("Günlük plan silinemedi", error);
    return NextResponse.json(
      { error: "Günlük plan silinemedi" },
      { status: 500 }
    );
  }
}
