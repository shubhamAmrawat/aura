import type { Request } from "express";

export type Client = "app" | "web";

/**
 * Which Aurora a request comes from. The app sends `X-Aurora-Client: app`. Older app builds are
 * recognised by Android's HTTP client (okhttp) — checked before the cookie, because the app also
 * keeps the `aura_token` cookie. Then: the cookie = website (browser, or its own server), a
 * Bearer token = app, a browser user agent = website.
 */
export function clientOf(req: Request): Client | null {
  const h = req.get("X-Aurora-Client")?.toLowerCase();
  if (h === "app" || h === "web") return h;
  const ua = req.get("User-Agent") ?? "";
  if (/okhttp|Expo|ReactNative/i.test(ua)) return "app";
  if (req.cookies?.aura_token) return "web";
  if (req.get("Authorization")?.startsWith("Bearer ")) return "app";
  if (/Mozilla\//.test(ua)) return "web";
  return null;
}

/** A real browser's user agent (not the website's own server, which also calls the API). */
export const browserAgent = (req: Request) => {
  const ua = req.get("User-Agent") ?? "";
  return /Mozilla\//.test(ua) ? ua.slice(0, 300) : null;
};
