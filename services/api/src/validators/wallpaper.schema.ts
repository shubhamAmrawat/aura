import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, required, requiredTrimmed } from "./common";

export const UploadUrlBody = z.object({
  fileType: z.custom<(typeof ALLOWED_IMAGE_TYPES)[number]>(
    (v) => (ALLOWED_IMAGE_TYPES as readonly unknown[]).includes(v),
    "Only JPEG, PNG and WebP are allowed"
  ),
});

/** Field order = check order of the old handler (title → file → category). */
export const UploadBody = z.object({
  title: requiredTrimmed("Title is required"),
  fileUrl: required("File is required"),
  key: required("File is required"),
  categoryId: required("Category is required"),
  description: z.any().optional(),
  tags: z.any().optional(),
  width: z.any().optional(),
  height: z.any().optional(),
  fileSizeBytes: z.any().optional(),
  fileType: z.any().optional(),
});
export type UploadInput = z.output<typeof UploadBody>;
