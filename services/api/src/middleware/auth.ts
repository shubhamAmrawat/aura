import { Context, Next } from "hono"; 
import { verifyToken } from "../lib/jwt";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization"); 
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return c.json({ error: "Unauthorized — no token provided" }, 401);
  }

  try {
    const payload = verifyToken(token);
    c.set("userId", payload.userId);
    c.set("email", payload.email);
    await next();
  } catch {
    return c.json({ error: "Unauthorized — invalid or expired token" }, 401);
  }
}