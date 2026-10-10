import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { users } from "../models";
import { ApiError } from "../utils/ApiError";
import { requireAuth } from "./auth";

/**
 * Admin-only guard: a valid login AND users.role = 'admin'.
 * The role is read from the database on every request (not from the JWT),
 * so removing someone's admin role takes effect immediately.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (authErr?: unknown) => {
    if (authErr) return next(authErr);
    db.select({ role: users.role })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1)
      .then(([row]) => {
        if (row?.role !== "admin") return next(new ApiError(403, "Admin access required."));
        next();
      })
      .catch(next);
  });
}
