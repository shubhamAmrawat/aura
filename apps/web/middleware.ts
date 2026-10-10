import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/sessionToken";

// Routes that require an authenticated session cookie to access
const PROTECTED_ROUTES = ["/upload", "/profile"];

const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("aura_token")?.value;

  // Admins are recognised from the signed session token (role claim), verified here
  // with JWT_SECRET — no API call. Invalid / expired / unsigned tokens → not an admin.
  const claims = token ? await verifySessionToken(token) : null;
  const isAdmin = claims?.role === "admin";

  // ─── Admin area ───────────────────────────────────────────────────────────
  // Anyone who isn't a signed-in admin gets a plain 404: /admin looks like it doesn't
  // exist, and no admin code is ever sent to them. (The API also checks every
  // /api/admin call against the database.)
  if (isAdminPath(pathname)) {
    if (!isAdmin) {
      return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
    return withSecurityHeaders(response);
  }

  // ─── Admins never see the public site ────────────────────────────────────
  if (isAdmin && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // ─── Auth guard ───────────────────────────────────────────────────────────
  // Check for the HTTP-only session cookie set by the API on login.
  // This avoids loading the full RSC tree before redirecting unauthenticated users.
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ─── Security + cache headers ─────────────────────────────────────────────
  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
