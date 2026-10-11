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
