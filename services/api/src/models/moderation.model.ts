import { pgTable, uuid, text, timestamp, index, primaryKey, check, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./user.model";
import { wallpapers } from "./wallpaper.model";

export const REPORT_REASONS = ["nudity", "violence", "hate", "harassment", "copyright", "spam", "impersonation", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** A report of a wallpaper or a user (see scripts/migrations/2026-10-22-reports-blocks.sql). */
export const contentReports = pgTable("content_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** null = reported by a guest, or the reporter deleted their account */
  reporterId: uuid("reporter_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  /** "wallpaper" | "user" */
  targetType: text("target_type").notNull(),
  wallpaperId: uuid("wallpaper_id").references((): AnyPgColumn => wallpapers.id, { onDelete: "set null" }),
  /** The reported user, or the creator of the reported wallpaper (null for admin uploads) */
  reportedUserId: uuid("reported_user_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  /** Wallpaper title or @username at the time of the report (kept if the target is deleted) */
  targetLabel: text("target_label"),
  reason: text("reason").notNull(),
  details: text("details"),
  /** "web" | "mobile" | "unknown" */
  source: text("source").notNull().default("unknown"),
  /** "open" | "actioned" | "dismissed" */
  status: text("status").notNull().default("open"),
  resolvedBy: uuid("resolved_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("content_reports_status_created_idx").on(t.status, t.createdAt),
  index("content_reports_wallpaper_idx").on(t.wallpaperId),
  index("content_reports_reported_user_idx").on(t.reportedUserId),
  check("content_reports_target_type_check", sql`${t.targetType} IN ('wallpaper', 'user')`),
  check("content_reports_status_check", sql`${t.status} IN ('open', 'actioned', 'dismissed')`),
]);

/** blocker no longer sees blocked's wallpapers in the app. */
export const userBlocks = pgTable("user_blocks", {
  blockerId: uuid("blocker_id").notNull().references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
  blockedId: uuid("blocked_id").notNull().references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("user_blocks_blocked_idx").on(t.blockedId)]);
