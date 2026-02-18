// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login", 
  "/enroll",
  "/api/auth/login", 
  "/api/auth/logout",
  "/api/face/enroll",
  "/api/face/recognize",
  "/api/users",
  "/_next", 
  "/favicon.ico",
  "/models",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionUserId = req.cookies.get("sessionUserId")?.value;

  if (!sessionUserId) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // User has a cookie, let them through
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
