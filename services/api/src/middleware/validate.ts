import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { parseOrThrow } from "../utils/validate";

/** Validate + replace req.body. Use only where validation is the handler's first step. */
export function validateBody<S extends z.ZodType>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = parseOrThrow(schema, req.body);
    next();
  };
}
