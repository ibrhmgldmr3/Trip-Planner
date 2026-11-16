import { NextResponse } from "next/server";
import { readBody, requireUserId, route } from "@/server/api";
import { deletePlan, getPlan, updatePlanStatus } from "@/server/plans";
import { statusPatchSchema } from "@/server/validation";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => {
  const userId = await requireUserId();
  const plan = await getPlan(userId, id);
  return NextResponse.json({ plan });
});

/** Plan durumunu değiştirir: iptal et, iptali geri al, gerçekleşti olarak işaretle. */
export const PATCH = route<Params>(async (request, { id }) => {
  const userId = await requireUserId();
  const { status } = await readBody(request, statusPatchSchema);
  const plan = await updatePlanStatus(userId, id, status);
  return NextResponse.json({ plan });
});

export const DELETE = route<Params>(async (_request, { id }) => {
  const userId = await requireUserId();
  await deletePlan(userId, id);
  return new NextResponse(null, { status: 204 });
});
