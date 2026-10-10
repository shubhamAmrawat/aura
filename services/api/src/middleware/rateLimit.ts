import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;
const requestCounts = new Map<string, Bucket>();

// Prevent unbounded Map growth — sweep expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of requestCounts) if (now > rec.resetAt) requestCounts.delete(ip);
}, 5 * 60_000).unref();

function getIp(req: Request): string {
  return (
    req.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Global limit: 100 requests / minute / IP.
 * NOTE: the old API also declared a 10/hour upload limiter, but its route pattern
 * never matched, so it never ran. It is intentionally not ported (see plan, Phase 9).
 */
export function globalRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = getIp(req);
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  if (record.count >= MAX_REQUESTS) {
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return;
  }
  record.count++;
  next();
}
