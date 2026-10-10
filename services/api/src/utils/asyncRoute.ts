import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "./ApiError";

/**
 * Wrap a controller. Known errors (ApiError) pass through unchanged; anything
 * unexpected is logged and becomes `fallbackStatus { error: fallbackMessage }`,
 * matching each endpoint's previous catch-all response.
 */
export function route(
  fallbackMessage: string,
  handler: (req: Request, res: Response) => Promise<unknown>,
  fallbackStatus = 500
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof ApiError) return next(err);
      if (fallbackStatus >= 500) console.error(`${fallbackMessage}:`, err);
      next(new ApiError(fallbackStatus, fallbackMessage));
    }
  };
}
