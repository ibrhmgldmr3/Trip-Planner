import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, clientIp } from "@/lib/rate-limit";
import { registerSchema, ilkHataMesaji } from "@/lib/api-schemas";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

/**
 * Saatlik IP başına kayıt hakkı.
 *
 * Ops'un yeniden dağıtım yapmadan ayarlayabilmesi için env üzerinden
 * override edilebiliyor. Ayrıca e2e testlerinin tek IP'den (127.0.0.1)
 * art arda birçok kullanıcı açması gerekiyor; `playwright.config.ts`
 * bu değeri test koşumları için yükseltiyor.
 */
const KAYIT_LIMITI = Number(process.env.REGISTER_RATE_LIMIT_PER_HOUR) || 5;

export async function POST(request: Request) {
  try {
    // Toplu hesap açmayı yavaşlat.
    const quota = await rateLimitAsync(
      `register:${clientIp(request)}`,
      KAYIT_LIMITI,
      60 * 60 * 1000
    );
    if (!quota.success) {
      return NextResponse.json(
        { error: "Çok fazla kayıt denemesi yapıldı, daha sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(quota.retryAfter) } }
      );
    }

    const body = await request.json();

    // Validate request body
    const result = registerSchema.safeParse(body);
    
    if (!result.success) {
      // DİKKAT: `format()._errors[0]` yalnızca KÖK hataları taşır; alan
      // hatalarında daima undefined olur ve şemadaki Türkçe mesajlar
      // kullanıcıya hiç ulaşmazdı.
      return NextResponse.json(
        { error: ilkHataMesaji(result.error, "Form bilgileri geçersiz") },
        { status: 400 }
      );
    }
    
    const { name, email, password } = result.data;

    // Check if user with email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kullanılıyor" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    // findUnique ile create arasında yarış var: iki eşzamanlı kayıt isteği
    // ikisi de "kullanıcı yok" görüp create'e girebilir. Unique ihlalini
    // (P2002) 500 yerine anlamlı bir 409 olarak karşılıyoruz.
    let user;
    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });
    } catch (createError) {
      if (
        createError instanceof Prisma.PrismaClientKnownRequestError &&
        createError.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Bu e-posta adresi zaten kullanılıyor" },
          { status: 409 }
        );
      }
      throw createError;
    }

    // Remove password from returned user object
    const userWithoutPassword = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return NextResponse.json(
      { 
        user: userWithoutPassword,
        message: "Kayıt başarılı! Giriş yapabilirsiniz."
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Kayıt oluşturulamadı", error);
    return NextResponse.json(
      { error: "Kullanıcı kaydı sırasında bir hata oluştu" },
      { status: 500 }
    );
  }
}

