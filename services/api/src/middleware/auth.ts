import { verifyToken } from "../lib/jwt";

const AURA_TOKEN_COOKIE_PREFIX = "aura_token=";

/** JWT from httpOnly cookie or Authorization (same rules everywhere). */
export function getAuthTokenFromRequest(c: {
  req: { header: (name: string) => string | undefined };
}): string | undefined {
  const cookieHeader = c.req.header("Cookie") ?? "";
  const cookiePair = cookieHeader
    .split(";")
    .map((s: string) => s.trim())
    .find((s: string) => s.startsWith(AURA_TOKEN_COOKIE_PREFIX));
  const cookieToken = cookiePair?.slice(AURA_TOKEN_COOKIE_PREFIX.length);

  const authHeader = c.req.header("Authorization");
  const headerToken = authHeader?.replace("Bearer ", "");

  return cookieToken || headerToken || undefined;
}

export const authMiddleware = async (c: any, next: any) => {
  try {
    const token = getAuthTokenFromRequest(c);

    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = verifyToken(token);
    c.set("userId", payload.userId);
    c.set("email", payload.email);
    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
};
