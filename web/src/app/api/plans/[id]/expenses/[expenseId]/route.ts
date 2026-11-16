import { NextResponse } from "next/server";
import { readBody, requireUserId, route } from "@/server/api";
import { deleteExpense, updateExpense } from "@/server/plans";
import { expensePatchSchema } from "@/server/validation";

type Params = { id: string; expenseId: string };

export const PATCH = route<Params>(async (request, { id, expenseId }) => {
  const userId = await requireUserId();
  const data = await readBody(request, expensePatchSchema);
  const expense = await updateExpense(userId, id, expenseId, data);
  return NextResponse.json({ expense });
});

export const DELETE = route<Params>(async (_request, { id, expenseId }) => {
  const userId = await requireUserId();
  await deleteExpense(userId, id, expenseId);
  return new NextResponse(null, { status: 204 });
});
