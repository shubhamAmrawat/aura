import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";

/** JWT from the httpOnly `aura_token` cookie or `Authorization: Bearer` — cookie wins. */
export function getAuthToken(req: Request): string | undefined {
  const cookieToken: string | undefined = req.cookies?.aura_token;
  const headerToken = req.get("Authorization")?.replace("Bearer ", "");
  return cookieToken || headerToken || undefined;
}

/** 401 unless a valid token is present; sets req.userId / req.userEmail. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getAuthToken(req);
  if (!token) return next(new ApiError(401, "Unauthorized"));
  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    next(new ApiError(401, "Unauthorized"));
  }
}

/** Never rejects; sets req.userId only when a valid token is present. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getAuthToken(req);
  if (token) {
    try {
      const payload = verifyToken(token);
      req.userId = payload.userId;
      req.userEmail = payload.email;
    } catch {
      /* invalid token = anonymous */
    }
  }
  next();
}
