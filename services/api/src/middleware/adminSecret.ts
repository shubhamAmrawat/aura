import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

/**
 * Shared-secret guard for admin endpoints (X-Admin-Secret header).
 * Fails closed: if ADMIN_SECRET is not configured, every request is rejected.
 */
export function requireAdminSecret(req: Request, _res: Response, next: NextFunction) {
  const expected = env.ADMIN_SECRET;
  if (!expected || req.get("X-Admin-Secret") !== expected) {
    return next(new ApiError(401, "Unauthorized"));
  }
  next();
}
