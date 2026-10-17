import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { ACCOUNT_DISABLED_MESSAGE, accountStatus } from "../utils/accountStatus";
import { touchLastActive } from "../utils/lastActive";

/** JWT from the httpOnly `aura_token` cookie or `Authorization: Bearer` — cookie wins. */
export function getAuthToken(req: Request): string | undefined {
  const cookieToken: string | undefined = req.cookies?.aura_token;
  const headerToken = req.get("Authorization")?.replace("Bearer ", "");
  return cookieToken || headerToken || undefined;
}

/**
 * 401 unless a valid token is present; 403 if the account has been disabled by an admin.
 * Sets req.userId / req.userEmail. (A deleted account passes through; handlers 404 as before.)
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getAuthToken(req);
  if (!token) return next(new ApiError(401, "Unauthorized"));
  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    return next(new ApiError(401, "Unauthorized"));
  }
  accountStatus(payload.userId)
    .then((status) => {
      if (status === "disabled") return next(new ApiError(403, ACCOUNT_DISABLED_MESSAGE));
      req.userId = payload.userId;
      req.userEmail = payload.email;
      if (status === "active") touchLastActive(payload.userId);
      next();
    })
    .catch(next);
}

/** Never rejects; sets req.userId only for a valid token of an account that isn't disabled. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getAuthToken(req);
  if (!token) return next();
  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    return next(); // invalid token = anonymous
  }
  accountStatus(payload.userId)
    .then((status) => {
      if (status !== "disabled") {
        req.userId = payload.userId;
        req.userEmail = payload.email;
        if (status === "active") touchLastActive(payload.userId);
      }
      next();
    })
    .catch(() => next());
}
