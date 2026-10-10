import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/ApiError";

/**
 * Accept a multipart form and expose the file named `field` as req.file.
 * Files over `maxBytes` → 400 `sizeMessage` (same check the old handlers did).
 */
export function singleImage(field: string, maxBytes: number, sizeMessage: string) {
  const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes } }).any();

  return (req: Request, res: Response, next: NextFunction) => {
    parser(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return next(new ApiError(400, sizeMessage));
        }
        return next(err);
      }
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      req.file = files.find((f) => f.fieldname === field);
      next();
    });
  };
}
