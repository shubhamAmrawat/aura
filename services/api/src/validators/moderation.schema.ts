import { z } from "zod";
import { REPORT_REASONS } from "../models/moderation.model";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const intIn = (min: number, max: number, fallback: number) =>
  z.preprocess((v) => (v === undefined || v === "" ? fallback : Number(v)), z.number().int().min(min).max(max));

/** Optional text: trimmed, empty → null. */
const optionalText = (max: number, message: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v ?? null), z.string().max(max, message).nullable());

export const REPORT_DETAILS_MAX = 500;

/** POST /api/reports */
export const CreateReportBody = z.object({
  targetType: z.enum(["wallpaper", "user"], { message: "targetType must be wallpaper or user" }),
  targetId: z.string({ message: "targetId is required" }).regex(UUID, "Invalid targetId"),
  reason: z.enum(REPORT_REASONS, { message: "Choose a reason" }),
  details: optionalText(REPORT_DETAILS_MAX, `Keep the details under ${REPORT_DETAILS_MAX} characters.`),
});

export const UserIdParam = z.object({ userId: z.string().regex(UUID, "Invalid user id") });
export const ReportIdParam = z.object({ id: z.string().regex(UUID, "Invalid id") });

/** GET /api/admin/reports */
export const AdminReportsQuery = z.object({
  status: z.enum(["open", "actioned", "dismissed"], { message: "status must be open, actioned or dismissed" }).default("open"),
  limit: intIn(1, 100, 50),
  offset: intIn(0, 100_000, 0),
});

/** POST /api/admin/reports/:id/resolve */
export const ResolveReportBody = z
  .object({
    /** What to do about the reported content; "none" = only close the report */
    action: z.enum(["none", "delete_wallpaper", "disable_user"], { message: "action must be none, delete_wallpaper or disable_user" }).default("none"),
    /** dismissed = nothing wrong; actioned = something was done about it */
    status: z.enum(["actioned", "dismissed"], { message: "status must be actioned or dismissed" }),
    note: optionalText(500, "Keep the note under 500 characters."),
  })
  .refine((b) => b.action === "none" || b.status === "actioned", "Use status actioned when taking an action.");
