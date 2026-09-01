import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { asilKalanlariTemizle, isOku } from "@/lib/plan-job";
import { logger } from "@/lib/logger";

/**
 * Plan üretim işinin durumu (Aşama 3).
 *
 * İstemci `POST /api/trip-plan-model`'den aldığı `jobId` ile bu ucu
 * sorguluyor. İş bittiğinde üretilen planın kendisi de dönüyor, böylece
 * istemcinin ikinci bir istek atmasına gerek kalmıyor.
 *
 * SAHİPLİK: `isOku` sorguyu `userId` ile daraltıyor; başka birinin işini
 * sorgulamak 404 dönüyor.
 */

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    // Asılı kalmış işleri burada topluyoruz: sunucu üretim ortasında yeniden
    // başlarsa iş RUNNING'de kalır ve kullanıcı sonsuza kadar "hazırlanıyor"
    // görür. Sorgulama zaten sık çağrıldığı için ayrı bir zamanlanmış göreve
    // gerek kalmıyor.
    await asilKalanlariTemizle(auth.user.id);

    const is = await isOku(id, auth.user.id);

    if (!is) {
      return NextResponse.json({ error: "İş bulunamadı" }, { status: 404 });
    }

    // İş bitmediyse yalnızca durum dönüyor.
    if (is.status !== "SUCCEEDED" || !is.tripPlanId) {
      return NextResponse.json({
        success: true,
        job: {
          id: is.id,
          status: is.status,
          step: is.step,
          error: is.error,
          createdAt: is.createdAt,
          finishedAt: is.finishedAt,
        },
      });
    }

    // Başarılı: planı da veriyoruz.
    // DİKKAT: `plan` alanının şekli istemci sözleşmesi — ai-planner sayfası
    // markdown/html/city/tripPlanId alanlarını okuyor.
    const plan = await prisma.tripPlan.findFirst({
      where: { id: is.tripPlanId, userId: auth.user.id },
      select: {
        id: true,
        city: true,
        country: true,
        startDate: true,
        endDate: true,
        duration: true,
        raw_markdown: true,
        raw_html: true,
        ai_model: true,
        plan_json: true,
        plan_schema_version: true,
      },
    });

    if (!plan) {
      // İş başarılı ama plan yok: kayıt silinmiş olabilir.
      return NextResponse.json({
        success: true,
        job: {
          id: is.id,
          status: "FAILED",
          step: is.step,
          error: "Üretilen plan bulunamadı",
          createdAt: is.createdAt,
          finishedAt: is.finishedAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      job: {
        id: is.id,
        status: is.status,
        step: is.step,
        error: null,
        createdAt: is.createdAt,
        finishedAt: is.finishedAt,
      },
      plan: {
        markdown: plan.raw_markdown ?? "",
        html: plan.raw_html ?? "",
        city: plan.city,
        country: plan.country ?? "",
        startDate: plan.startDate ? plan.startDate.toISOString().slice(0, 10) : null,
        endDate: plan.endDate ? plan.endDate.toISOString().slice(0, 10) : null,
        duration: plan.duration,
        tripPlanId: plan.id,
        format: plan.plan_schema_version ? "structured" : "markdown",
        structured: plan.plan_json,
        metadata: {
          model: plan.ai_model,
          schemaVersion: plan.plan_schema_version,
          savedToDatabase: true,
        },
      },
    });
  } catch (error) {
    logger.error("İş durumu okunamadı", error);
    return NextResponse.json(
      { error: "İş durumu okunamadı" },
      { status: 500 }
    );
  }
}
