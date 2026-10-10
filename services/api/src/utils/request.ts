import type { Request } from "express";
import { ApiError } from "./ApiError";

/** First value of a query param as a string (Express may give string[] for repeats). */
export function queryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

/** Route param as a string. */
export function param(req: Request, key: string): string {
  return String(req.params[key] ?? "");
}

/** userId set by requireAuth. */
export function authUserId(req: Request): string {
  if (!req.userId) throw new ApiError(401, "Unauthorized");
  return req.userId;
}
