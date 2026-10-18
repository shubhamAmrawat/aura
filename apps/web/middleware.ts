import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/sessionToken";

// Routes that require an authenticated session cookie to access
const PROTECTED_ROUTES = ["/upload", "/profile", "/settings", "/welcome"];

const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

// ─── Renamed / merged categories ────────────────────────────────────────────
// Old category slugs answer with a real 308 (the page itself streams, so it can't).
// The old→new map is tiny; each server instance refreshes it at most every 5 minutes.
const REDIRECTS_TTL_MS = 5 * 60 * 1000;
let categoryRedirects: { at: number; map: Record<string, string> } = { at: 0, map: {} };

async function categoryRedirectFor(slug: string): Promise<string | undefined> {
  if (Date.now() - categoryRedirects.at > REDIRECTS_TTL_MS) {
    const previous = categoryRedirects.map;
    categoryRedirects = { at: Date.now(), map: previous }; // one refresh at a time; keep serving the old map
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories/redirects`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) categoryRedirects = { at: Date.now(), map: ((await res.json()) as { data: Record<string, string> }).data ?? {} };
    } catch {
      // API unreachable → keep the previous map; the page falls back to its own lookup
    }
  }
  return categoryRedirects.map[slug];
}

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

  // ─── Old category addresses ──────────────────────────────────────────────
  const cat = /^\/category\/([^/]+)\/?$/.exec(pathname);
  if (cat) {
    let slug = cat[1]!;
    try { slug = decodeURIComponent(slug); } catch { /* malformed %-escape → use as is */ }
    const to = await categoryRedirectFor(slug.toLowerCase());
    if (to) return NextResponse.redirect(new URL(`/category/${to}${request.nextUrl.search}`, request.url), 308);
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
