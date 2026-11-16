import { NextResponse } from "next/server";
import { readBody, requireUserId, route } from "@/server/api";
import { addExpense } from "@/server/plans";
import { expenseCreateSchema } from "@/server/validation";

type Params = { id: string };

/** Plana gerçek bir harcama ekler. (Liste, plan ayrıntısıyla birlikte gelir.) */
export const POST = route<Params>(async (request, { id }) => {
  const userId = await requireUserId();
  const data = await readBody(request, expenseCreateSchema);
  const expense = await addExpense(userId, id, data);
  return NextResponse.json({ expense }, { status: 201 });
});
