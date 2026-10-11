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
  status: z.enum(["all", "approved", "pending", "rejected"], { message: "Invalid status" }).default("all"),
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
