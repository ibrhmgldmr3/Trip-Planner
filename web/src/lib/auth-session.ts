import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

/**
 * Route handler'lar için tek kimlik giriş noktası.
 *
 * NEDEN VAR: rotaların büyük kısmı `session.user.id as string` yazıp bu
 * değeri doğrudan Prisma `where`ine koyuyordu. `next-auth.d.ts` alanı
 * `string` (zorunlu) ilan ettiği için TypeScript itiraz etmiyor, ama değer
 * JWT'nin `sub` alanından geliyor ve yoksa `undefined` oluyor. Prisma'da
 * `where: { id, userId: undefined }` "filtre verilmedi" anlamına gelir —
 * yani sahiplik koşulu SESSİZCE DÜŞER ve giriş yapmış herhangi bir kullanıcı
 * id'sini bildiği her kaydı okuyup silebilir hale gelir.
 *
 * Buradaki fonksiyonlar id'yi asla `undefined` bırakmaz ve kimliği her
 * seferinde veritabanından doğrular: JWT uzun ömürlü, silinmiş bir kullanıcının
 * token'ı hâlâ geçerli görünebiliyor.
 */

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export type AuthResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse };

/**
 * Oturumu doğrular ve kullanıcıyı veritabanından çözer.
 *
 * Başarısızlıkta hazır bir `NextResponse` döner; çağıran sadece geri verir:
 *
 *   const auth = await requireUser();
 *   if (!auth.ok) return auth.response;
 *   const { id: userId } = auth.user;
 */
export async function requireUser(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  // E-posta ya da id — hangisi varsa onunla kullanıcıyı bulabiliriz.
  const sessionEmail = session?.user?.email ?? null;
  const sessionId = session?.user?.id ?? null;

  if (!sessionEmail && !sessionId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Giriş yapmanız gerekiyor" },
        { status: 401 }
      ),
    };
  }

  const user = sessionId
    ? await prisma.user.findUnique({
        where: { id: sessionId },
        select: { id: true, email: true },
      })
    : await prisma.user.findUnique({
        where: { email: sessionEmail as string },
        select: { id: true, email: true },
      });

  if (!user) {
    // Token geçerli ama kullanıcı silinmiş: oturumu sahiplendirmiyoruz.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 401 }
      ),
    };
  }

  return { ok: true, user };
}
