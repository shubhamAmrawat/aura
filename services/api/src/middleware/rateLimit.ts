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

/**
 * Client IP used as the rate-limit key.
 * In production every request reaches Render through Cloudflare, which sets
 * CF-Connecting-IP to the real client address (clients can't override it).
 * X-Forwarded-For is NOT used: its first entry is whatever the client sent.
 * Locally (no Cloudflare) the socket address is used.
 */
export function getClientIp(req: Request): string {
  return req.get("cf-connecting-ip")?.trim() || req.socket.remoteAddress || "unknown";
}

/** Global limit: 100 requests / minute / client IP. */
export function globalRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
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
