/**
 * Android App Links: www.aurora-walls.com links open in the app (see android.intentFilters in
 * app.json and the website's /.well-known/assetlinks.json). Most website paths match app routes
 * one to one (/wallpaper/:id, /category/:slug, /collection/:id); the few that differ are
 * rewritten here. Runs for links that open the app; never throws.
 */
const WEB_HOSTS = new Set(["www.aurora-walls.com", "aurora-walls.com"]);

function decodeSegment(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Website path → app route. null = no rule for this path. */
export function webPathToAppRoute(pathname: string, search: URLSearchParams): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  const one = (prefix: string) => {
    const m = new RegExp(`^/${prefix}/([^/]+)$`).exec(p);
    return m ? `/${prefix}/${encodeURIComponent(decodeSegment(m[1]!))}` : null;
  };
  const direct = one("wallpaper") ?? one("category") ?? one("collection");
  if (direct) return direct;
  if (p === "/trending") return "/feed/trending";
  if (p === "/latest") return "/feed/latest";
  if (p === "/categories") return "/explore";
  if (p === "/search") {
    const q = search.get("q")?.trim();
    return q ? `/explore?q=${encodeURIComponent(q)}` : "/explore";
  }
  return null;
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, "aurora://app");
    const isWebsite = (url.protocol === "https:" || url.protocol === "http:") && WEB_HOSTS.has(url.hostname);
    if (isWebsite) return webPathToAppRoute(url.pathname, url.searchParams) ?? "/";
    // A bare path (or aurora://…): rewrite the website-only paths, leave app routes alone.
    if (path.startsWith("/")) return webPathToAppRoute(url.pathname, url.searchParams) ?? path;
    return path;
  } catch {
    return "/";
  }
}
