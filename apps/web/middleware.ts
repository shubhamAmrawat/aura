import { NextRequest, NextResponse } from "next/server";

// Routes that require an authenticated session cookie to access
const PROTECTED_ROUTES = ["/upload", "/profile"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Auth guard ───────────────────────────────────────────────────────────
  // Check for the HTTP-only session cookie set by the API on login.
  // This avoids loading the full RSC tree before redirecting unauthenticated users.
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected && !request.cookies.get("aura_token")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ─── Security + cache headers ─────────────────────────────────────────────
  const response = NextResponse.next();

  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
