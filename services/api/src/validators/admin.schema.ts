import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const intIn = (min: number, max: number, fallback: number) =>
  z.preprocess(
    (v) => (v === undefined || v === "" ? fallback : Number(v)),
    z.number().int().min(min).max(max)
  );

export const ReviewListQuery = z.object({
  status: z.enum(["pending", "rejected"], { message: "status must be pending or rejected" }).default("pending"),
  limit: intIn(1, 100, 24),
  offset: intIn(0, 100_000, 0),
});

export const DashboardQuery = z.object({
  days: z.preprocess(
    (v) => (v === undefined || v === "" ? 30 : Number(v)),
    z.union([z.literal(7), z.literal(30), z.literal(90)], { message: "days must be 7, 30 or 90" })
  ),
});

export const WallpaperIdParam = z.object({
  id: z.string().regex(UUID, "Invalid wallpaper id"),
});

const reason = z
  .string({ message: "A reason is required (3–300 characters)." })
  .trim()
  .min(3, "A reason is required (3–300 characters).")
  .max(300, "A reason is required (3–300 characters).");

export const RejectBody = z.object({ reason });

export const BulkReviewBody = z
  .object({
    ids: z
      .array(z.string().regex(UUID, "Invalid wallpaper id"), { message: "ids must be a list of wallpaper ids" })
      .min(1, "Select at least one wallpaper.")
      .max(100, "At most 100 wallpapers at a time."),
    action: z.enum(["approve", "reject"], { message: "action must be approve or reject" }),
    reason: z.unknown().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.action === "reject" && !reason.safeParse(body.reason).success) {
      ctx.addIssue({ code: "custom", message: "A reason is required (3–300 characters).", path: ["reason"] });
    }
  });

// ─── Wallpaper management (Phase 3) ─────────────────────────

const boolParam = (name: string) =>
  z
    .enum(["true", "false"], { message: `${name} must be true or false` })
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true"));

export const WallpaperListQuery = z.object({
  q: z.string().trim().max(100, "Search is too long").optional(),
  status: z.enum(["all", "approved", "pending", "rejected", "hidden"], { message: "Invalid status" }).default("all"),
  categoryId: z
    .string()
    .refine((v) => v === "none" || UUID.test(v), "Invalid category")
    .optional(),
  uploader: z.string().trim().max(60).optional(),
  featured: boolParam("featured"),
  premium: boolParam("premium"),
  mobile: boolParam("mobile"),
  ai: boolParam("ai"),
  resolution: z.enum(["4k", "qhd", "fhd", "hd", "low"], { message: "Invalid resolution" }).optional(),
  sort: z
    .enum(["newest", "oldest", "downloads", "likes", "views", "trending", "title"], { message: "Invalid sort" })
    .default("newest"),
  limit: intIn(1, 100, 50),
  offset: intIn(0, 1_000_000, 0),
});

/** Trim, drop empties, de-duplicate (case-insensitive, first spelling wins). */
const tagList = z
  .array(z.string({ message: "Tags must be text" }).max(40, "Each tag can be at most 40 characters"), {
    message: "tags must be a list",
  })
  .max(30, "At most 30 tags")
  .transform((tags) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags) {
      const t = raw.trim();
      if (t && !seen.has(t.toLowerCase())) {
        seen.add(t.toLowerCase());
        out.push(t);
      }
    }
    return out;
  });

export const WallpaperPatchBody = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120, "Title can be at most 120 characters").optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description can be at most 1000 characters")
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? undefined : v || null)),
    tags: tagList.optional(),
    categoryId: z.string().regex(UUID, "Invalid category").nullable().optional(),
    isFeatured: z.boolean({ message: "isFeatured must be true or false" }).optional(),
    isPremium: z.boolean({ message: "isPremium must be true or false" }).optional(),
    isMobile: z.boolean({ message: "isMobile must be true or false" }).optional(),
    isAiGenerated: z.boolean({ message: "isAiGenerated must be true or false" }).optional(),
  })
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Nothing to update");

export const WallpaperBulkBody = z
  .object({
    ids: z
      .array(z.string().regex(UUID, "Invalid wallpaper id"), { message: "ids must be a list of wallpaper ids" })
      .min(1, "Select at least one wallpaper.")
      .max(100, "At most 100 wallpapers at a time."),
    action: z.enum(["feature", "unfeature", "setCategory", "addTags", "removeTags", "delete"], { message: "Invalid action" }),
    categoryId: z.string().regex(UUID, "Invalid category").nullable().optional(),
    tags: tagList.optional(),
  })
  .superRefine((b, ctx) => {
    if (b.action === "setCategory" && b.categoryId === undefined) {
      ctx.addIssue({ code: "custom", message: "Choose a category.", path: ["categoryId"] });
    }
    if ((b.action === "addTags" || b.action === "removeTags") && !b.tags?.length) {
      ctx.addIssue({ code: "custom", message: "Enter at least one tag.", path: ["tags"] });
    }
  });

// ─── Featured (home page hero) ──────────────────────────────

export const FeaturedOrderBody = z.object({
  ids: z
    .array(z.string().regex(UUID, "Invalid wallpaper id"), { message: "ids must be a list of wallpaper ids" })
    .max(500, "Too many wallpapers"),
});

export const FeaturedLimitBody = z.object({
  limit: z
    .number({ message: "limit must be a number from 1 to 10" })
    .int("limit must be a number from 1 to 10")
    .min(1, "limit must be a number from 1 to 10")
    .max(10, "limit must be a number from 1 to 10"),
});

// ─── Bulk upload (Phase 4) ──────────────────────────────────

export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const UPLOAD_MAX_FILES = 50;
const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const uploadType = z.enum(UPLOAD_TYPES, { message: "Only JPEG, PNG and WebP images are allowed." });
const uploadSize = z
  .number({ message: "fileSizeBytes must be a number" })
  .int("fileSizeBytes must be a whole number")
  .min(1, "The file is empty.")
  .max(UPLOAD_MAX_BYTES, "Each file must be 25 MB or smaller.");

export const UploadUrlsBody = z.object({
  files: z
    .array(z.object({ fileType: uploadType, fileSizeBytes: uploadSize }), { message: "files must be a list" })
    .min(1, `Send 1 to ${UPLOAD_MAX_FILES} files at a time.`)
    .max(UPLOAD_MAX_FILES, `Send 1 to ${UPLOAD_MAX_FILES} files at a time.`),
});

export const AdminUploadBody = z
  .object({
    key: z.string({ message: "key is required" }).min(1, "key is required"),
    fileUrl: z.string({ message: "fileUrl is required" }).min(1, "fileUrl is required"),
    fileType: uploadType,
    fileSizeBytes: uploadSize,
    width: z.number().int().min(0).optional(),
    height: z.number().int().min(0).optional(),
    title: z.string({ message: "Title is required" }).trim().min(1, "Title is required").max(120, "Title can be at most 120 characters"),
    description: z
      .string()
      .trim()
      .max(1000, "Description can be at most 1000 characters")
      .nullable()
      .optional()
      .transform((v) => v || null),
    tags: tagList.default([]),
    /** a category id, or "auto" to let the AI pick from the image */
    categoryId: z.string({ message: "Category is required" }).refine((v) => v === "auto" || UUID.test(v), "Category is required"),
    isPremium: z.boolean({ message: "isPremium must be true or false" }).default(false),
    isAiGenerated: z.boolean({ message: "isAiGenerated must be true or false" }).default(false),
    publish: z.boolean({ message: "publish must be true or false" }).default(true),
  })
  .strict();
export type AdminUploadInput = z.output<typeof AdminUploadBody>;

// ─── Categories (Phase 5) ───────────────────────────────────

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const categoryName = z
  .string({ message: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(40, "Name can be at most 40 characters");
const categorySlug = z
  .string({ message: "Slug is required" })
  .trim()
  .min(2, "Slug must be 2–40 characters")
  .max(40, "Slug must be 2–40 characters")
  .regex(SLUG, "Slug can only use lowercase letters, numbers and single hyphens");
const categoryDescription = z
  .string()
  .trim()
  .max(300, "Description can be at most 300 characters")
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

export const CategoryCreateBody = z
  .object({ name: categoryName, slug: categorySlug.optional(), description: categoryDescription })
  .strict();

export const CategoryPatchBody = z
  .object({
    name: categoryName.optional(),
    slug: categorySlug.optional(),
    description: categoryDescription,
    coverImageUrl: z.string({ message: "coverImageUrl must be a URL or null" }).url("coverImageUrl must be a URL or null").nullable().optional(),
  })
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Nothing to update");

export const CategoryOrderBody = z.object({
  ids: z
    .array(z.string().regex(UUID, "Invalid category id"), { message: "ids must be a list of category ids" })
    .min(1, "ids must be a list of category ids")
    .max(200, "Too many categories"),
});

export const CategoryDeleteQuery = z.object({
  moveTo: z.string().regex(UUID, "Invalid category to move to").optional(),
});

export const SuggestionListQuery = z.object({
  kind: z.enum(["uncategorized", "moves"], { message: "kind must be uncategorized or moves" }).default("uncategorized"),
});

export const SuggestionApplyBody = z.object({
  items: z
    .array(
      z.object({
        wallpaperId: z.string().regex(UUID, "Invalid wallpaper id"),
        categoryId: z.string({ message: "Choose a category" }).regex(UUID, "Choose a category"),
      }),
      { message: "items must be a list" }
    )
    .min(1, "Select at least one wallpaper.")
    .max(500, "Apply at most 500 at a time."),
});

export const SuggestionDismissBody = z.object({
  wallpaperIds: z
    .array(z.string().regex(UUID, "Invalid wallpaper id"), { message: "wallpaperIds must be a list" })
    .min(1, "Select at least one wallpaper.")
    .max(500, "Dismiss at most 500 at a time."),
});

// ─── Users (Phase 6) ────────────────────────────────────────

export const UserListQuery = z.object({
  q: z.string().trim().max(100, "Search is too long").optional(),
  role: z.enum(["all", "user", "admin"], { message: "Invalid role" }).default("all"),
  status: z.enum(["all", "active", "disabled"], { message: "Invalid status" }).default("all"),
  creator: boolParam("creator"),
  signIn: z.enum(["google", "password", "google-only", "password-only"], { message: "Invalid sign-in filter" }).optional(),
  locked: boolParam("locked"),
  sort: z.enum(["newest", "oldest", "uploads", "downloads", "likes", "name"], { message: "Invalid sort" }).default("newest"),
  limit: intIn(1, 100, 50),
  offset: intIn(0, 1_000_000, 0),
});

export const UserIdParam = z.object({
  id: z.string().regex(UUID, "User not found"),
});

export const UserPatchBody = z
  .object({ isCreator: z.boolean({ message: "isCreator must be true or false" }) })
  .strict();

export const UserDisableBody = z.object({
  reason: z
    .string({ message: "A reason is required (3–300 characters)." })
    .trim()
    .min(3, "A reason is required (3–300 characters).")
    .max(300, "A reason is required (3–300 characters)."),
});

export const UserDeleteBody = z.object({
  confirmEmail: z.string({ message: "Type the user's email to confirm." }).trim().min(1, "Type the user's email to confirm."),
});
