import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, required, requiredTrimmed } from "./common";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  /** 0–2 more categories it also belongs in (the AI suggests them) */
  extraCategoryIds: z.array(z.string().regex(UUID_RE, "Category not found")).max(2, "Pick at most 2 extra categories.").optional(),
});

export const PrepareUploadBody = z.object({
  key: z.string({ message: "File is required" }).min(1, "File is required"),
  fileUrl: z.string({ message: "File is required" }).min(1, "File is required"),
  fileType: z.enum(["image/jpeg", "image/png", "image/webp"], { message: "Only JPEG, PNG and WebP images are allowed." }),
  fileSizeBytes: z.number({ message: "fileSizeBytes is required" }).int().positive().max(25 * 1024 * 1024, "Files must be smaller than 25 MB."),
});

export const DiscardUploadBody = z.object({ key: z.string({ message: "key is required" }).min(1, "key is required") });

export type UploadInput = z.output<typeof UploadBody>;
