import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  
  // Define protected routes
  const protectedPaths = [
    "/profile",
    "/my-trips",
  ];

  const path = request.nextUrl.pathname;
  
  // Check if the current path is a protected path
  const isProtectedPath = protectedPaths.some((protectedPath) => 
    path === protectedPath || path.startsWith(`${protectedPath}/`)
  );

  if (isProtectedPath && !token) {
    // Redirect unauthenticated users to login page
    const url = new URL(`/login`, request.url);
    url.searchParams.set("callbackUrl", encodeURI(request.url));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Only run middleware on specific paths
export const config = {
  matcher: [
    "/profile/:path*",
    "/my-trips/:path*",
  ],
};
