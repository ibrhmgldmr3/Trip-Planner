import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Canlılık denetimi: uygulama ayakta mı ve veritabanına ulaşabiliyor mu? */
export async function GET() {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  return NextResponse.json(
    { status: database === "ok" ? "ok" : "error", database, timestamp: new Date().toISOString() },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
