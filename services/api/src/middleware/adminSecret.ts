import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

/** Simple shared-secret guard for admin endpoints (X-Admin-Secret header). */
export function requireAdminSecret(req: Request, _res: Response, next: NextFunction) {
  if (req.get("X-Admin-Secret") !== env.ADMIN_SECRET) {
    return next(new ApiError(401, "Unauthorized"));
  }
  next();
}
