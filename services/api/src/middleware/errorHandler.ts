import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/ApiError";

/** Single place that turns errors into `{ error: string }` responses. */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // body-parser errors (malformed / oversized JSON)
  const type = (err as { type?: string })?.type;
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large" });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
}
