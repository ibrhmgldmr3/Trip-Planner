import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, readBody, route } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { registerSchema } from "@/server/validation";

export const POST = route(async (request) => {
  const limited = rateLimit(`register:${clientIp(request.headers)}`, 5, 60 * 60 * 1000);
  if (!limited.ok) {
    throw new ApiError(429, "Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar dene.", {
      "Retry-After": String(limited.retryAfter),
    });
  }

  const { name, email, password } = await readBody(request, registerSchema);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(409, "Bu e-posta adresi zaten kullanılıyor.");
  }

  const user = await prisma.user.create({
    data: { name, email, password: await bcrypt.hash(password, 12) },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ user }, { status: 201 });
});
