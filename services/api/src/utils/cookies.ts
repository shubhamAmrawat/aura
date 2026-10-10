import type { Response } from "express";
import { isProduction } from "../config/env";

const SEVEN_DAYS = 7 * 24 * 60 * 60;

// Raw header strings are kept byte-for-byte identical to the previous API.
export function setAuthCookie(res: Response, token: string): void {
  const options = isProduction
    ? `HttpOnly; Path=/; Max-Age=${SEVEN_DAYS}; SameSite=Lax; Domain=.aurora-walls.com; Secure`
    : `HttpOnly; Path=/; Max-Age=${SEVEN_DAYS}; SameSite=Lax`;
  res.setHeader("Set-Cookie", `aura_token=${token}; ${options}`);
}

export function clearAuthCookie(res: Response): void {
  const domain = isProduction ? "; Domain=.aurora-walls.com" : "";
  res.setHeader("Set-Cookie", `aura_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${domain}`);
}
