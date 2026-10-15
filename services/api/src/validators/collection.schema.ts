import { z } from "zod";
import { required, requiredTrimmed } from "./common";

export const COLLECTION_TITLE_MAX = 60;
export const COLLECTION_DESCRIPTION_MAX = 300;

const titleTooLong = `Collection title must be ${COLLECTION_TITLE_MAX} characters or fewer`;
const descriptionTooLong = `Description must be ${COLLECTION_DESCRIPTION_MAX} characters or fewer`;

/** Optional description: a string (trimmed; empty → null) or null to clear it. */
const description = z
  .union([z.string({ message: "Description must be text" }), z.null()], { message: "Description must be text" })
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null ? null : v.trim() || null))
  .refine((v) => v == null || v.length <= COLLECTION_DESCRIPTION_MAX, descriptionTooLong);

const isPublic = z.boolean({ message: "isPublic must be true or false" }).optional();

export const CreateCollectionBody = z.object({
  title: requiredTrimmed("Collection title is required")
    .transform((v) => v.trim())
    .refine((v) => v.length <= COLLECTION_TITLE_MAX, titleTooLong),
  description,
  isPublic,
});

export const UpdateCollectionBody = z
  .object({
    title: z
      .custom<string>((v) => v === undefined || (typeof v === "string" && v.trim().length > 0), "Collection title is required")
      .optional()
      .transform((v) => v?.trim())
      .refine((v) => v === undefined || v.length <= COLLECTION_TITLE_MAX, titleTooLong),
    description,
    isPublic,
  })
  .refine((b) => b.title !== undefined || b.description !== undefined || b.isPublic !== undefined, "Nothing to update");

export const AddWallpaperBody = z.object({
  wallpaperId: required("wallpaperId is required"),
});
