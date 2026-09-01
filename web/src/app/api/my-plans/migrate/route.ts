import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-session";
import { rateLimitAsync } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { planiTaslagaCevir } from "@/lib/plan-migration";
import { tumPlanlariTasi } from "@/lib/plan-migration-runner";
import { logger } from "@/lib/logger";

/**
 * Kullanıcının planlarını ilişkisel modele taşır (Aşama 1).
 *
 * NEDEN KULLANICI KAPSAMLI: uygulamada yönetici rolü yok. Taşımayı bir admin
 * ucuna bağlamak, olmayan bir yetki modelini uydurmak olurdu. Bunun yerine
 * her kullanıcı YALNIZCA kendi planlarını taşıyor; `requireUser` zaten
 * kapsamı daraltıyor ve toplu taşıma için bu uç kullanıcı listesi üzerinde
 * döngüye alınabiliyor.
 *
 * GET  → kuru çalışma: neyin taşınacağını, neyin neden atlanacağını raporlar.
 *        Hiçbir şey yazmaz.
 * POST → taşımayı uygular.
 *
 * Taşıma YIKICI DEĞİL: JSON sütunlarına dokunulmuyor, plan `migratedAt`
 * damgasıyla işaretleniyor. Yeniden çalıştırmak güvenli.
 */

/** Dönüştürücünün okuduğu alanlar. */
const ALANLAR = {
  id: true,
  city: true,
  country: true,
  startDate: true,
  endDate: true,
  status: true,
  total_cost: true,
  sehir_bilgisi: true,
  pratik_bilgiler: true,
  gun_plani: true,
  butce_tahmini: true,
  migratedAt: true,
} as const;

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const planlar = await prisma.tripPlan.findMany({
      where: { userId: auth.user.id },
      select: ALANLAR,
      orderBy: { createdAt: "asc" },
    });

    const rapor = planlar.map((plan) => {
      if (plan.migratedAt) {
        return { planId: plan.id, city: plan.city, durum: "zaten-tasinmis" as const };
      }

      const donusum = planiTaslagaCevir(plan);

      if (!donusum.ok) {
        return {
          planId: plan.id,
          city: plan.city,
          durum: "atlanacak" as const,
          engel: donusum.engel,
        };
      }

      return {
        planId: plan.id,
        city: plan.city,
        durum: "tasinacak" as const,
        uyarilar: donusum.uyarilar,
        sayilar: {
          budgetItems: donusum.taslak.budgetItems.length,
          dailyPlans: donusum.taslak.dailyPlans.length,
        },
      };
    });

    return NextResponse.json({
      success: true,
      kuruCalisma: true,
      ozet: {
        toplam: rapor.length,
        tasinacak: rapor.filter((r) => r.durum === "tasinacak").length,
        atlanacak: rapor.filter((r) => r.durum === "atlanacak").length,
        zatenTasinmis: rapor.filter((r) => r.durum === "zaten-tasinmis").length,
      },
      planlar: rapor,
    });
  } catch (error) {
    logger.error("Taşıma raporu üretilemedi", error);
    return NextResponse.json(
      { error: "Taşıma raporu üretilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    // Taşıma çok sayıda yazma yapıyor; kaza sonucu tekrar tetiklenmesin.
    const quota = await rateLimitAsync(`plan-migrate:${auth.user.id}`, 3, 60 * 60 * 1000);
    if (!quota.success) {
      return NextResponse.json(
        { error: "Taşıma çok sık tetiklendi, bir süre sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(quota.retryAfter) } }
      );
    }

    // `?yeniden=1` zaten taşınmış planları da yeniden üretir. Kısmi kalmış
    // bir taşımayı düzeltmenin yolu bu; alt kayıtlar silinip yeniden yazılır.
    const yenidenTasi = new URL(request.url).searchParams.get("yeniden") === "1";

    const ozet = await tumPlanlariTasi({ userId: auth.user.id, yenidenTasi });

    return NextResponse.json({
      success: true,
      ozet: {
        toplam: ozet.toplam,
        tasindi: ozet.tasindi,
        atlandi: ozet.atlandi,
        zatenTasinmis: ozet.zatenTasinmis,
        hata: ozet.hata,
      },
      sonuclar: ozet.sonuclar,
    });
  } catch (error) {
    logger.error("Planlar taşınamadı", error);
    return NextResponse.json({ error: "Planlar taşınamadı" }, { status: 500 });
  }
}
