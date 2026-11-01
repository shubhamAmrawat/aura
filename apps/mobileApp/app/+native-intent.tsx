import { DeviceEventEmitter } from "react-native";
import AuroraNotify from "../modules/aurora-notify";
import { UPDATE_REQUESTED } from "../lib/appUpdate";
import { reportOpened } from "../lib/notifications";

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

/**
 * aurora://… from a notification (modules/aurora-notify): clears that notification (its id is
 * the `_n` param) and opens the path. aurora://update starts the app update.
 */
function fromNotification(path: string): string {
  const rest = path.slice("aurora://".length);
  const q = rest.indexOf("?");
  const route = "/" + (q < 0 ? rest : rest.slice(0, q)).replace(/^\/+/, "");
  const params = q < 0 ? [] : rest.slice(q + 1).split("&").filter(Boolean);
  const n = params.find((p) => p.startsWith("_n="));
  if (n) {
    const id = Number(n.slice(3));
    if (Number.isFinite(id)) {
      try {
        AuroraNotify?.cancelNotification(id);
      } catch {
        /* already gone */
      }
    }
  }
  // open tracking: which delivery was tapped, and which button
  const d = params.find((p) => p.startsWith("_d="));
  if (d) {
    const a = params.find((p) => p.startsWith("_a="));
    void reportOpened(decodeURIComponent(d.slice(3)), a ? decodeURIComponent(a.slice(3)) : "tap");
  }
  if (route === "/update") {
    setTimeout(() => DeviceEventEmitter.emit(UPDATE_REQUESTED), 600);
    return "/";
  }
  const kept = params.filter((p) => !/^_(n|d|a)=/.test(p));
  return route + (kept.length ? `?${kept.join("&")}` : "");
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // Only links built by our notifications (they carry _n=, or are aurora://update). Everything else,
    // e.g. the dev client's own aurora://expo-development-client/… launch link, is left to Expo Router.
    if (/^aurora:\/\/update(\?|$)/.test(path) || (path.startsWith("aurora://") && /[?&]_n=/.test(path))) return fromNotification(path);
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
