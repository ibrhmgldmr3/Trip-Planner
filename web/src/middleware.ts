import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Hesaba özel sayfalar: oturum yoksa girişe yönlendirilir.
// (API uçları kendi yetki denetimini yapar; burası yalnızca sayfalar içindir.)
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/ai-planner/:path*",
    "/manual-planner/:path*",
    "/my-plans/:path*",
    "/my-trips/:path*",
    "/plan-detail/:path*",
    "/budget/:path*",
    "/profile/:path*",
  ],
};
