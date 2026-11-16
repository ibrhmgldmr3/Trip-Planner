import { NextResponse } from "next/server";
import { readBody, requireUserId, route } from "@/server/api";
import { createManualPlan, listPlans } from "@/server/plans";
import { manualPlanSchema, statusPatchSchema } from "@/server/validation";

/** Kullanıcının planları. `?status=DONE` gibi bir süzgeç verilebilir. */
export const GET = route(async (request) => {
  const userId = await requireUserId();
  const raw = new URL(request.url).searchParams.get("status");
  const status = raw ? statusPatchSchema.parse({ status: raw }).status : undefined;
  const plans = await listPlans(userId, status);
  return NextResponse.json({ plans });
});

/** Manuel plan kaydı. */
export const POST = route(async (request) => {
  const userId = await requireUserId();
  const input = await readBody(request, manualPlanSchema);
  const id = await createManualPlan(userId, input);
  return NextResponse.json({ id }, { status: 201 });
});
