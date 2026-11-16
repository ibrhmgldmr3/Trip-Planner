import { NextResponse } from "next/server";
import { readBody, requireUserId, route } from "@/server/api";
import { createAiPlan } from "@/server/plans";
import { generatePlanSchema } from "@/server/validation";

// Dil modeli yanıtı uzun sürebilir (barındırma platformunun izin verdiği üst sınıra bağlıdır).
export const maxDuration = 120;

/** AI ile plan üretir, kaydeder ve yeni planın kimliğini döner. */
export const POST = route(async (request) => {
  const userId = await requireUserId();
  const input = await readBody(request, generatePlanSchema);
  const id = await createAiPlan(userId, input);
  return NextResponse.json({ id }, { status: 201 });
});
