import { pgTable, uuid, text, integer, timestamp, index, check, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./user.model";

/** A request to become a creator (see scripts/migrations/2026-10-19-creator-applications.sql). */
export const creatorApplications = pgTable("creator_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
  /** "pending" | "approved" | "rejected" */
  status: text("status").notNull().default("pending"),
  about: text("about"),
  portfolioUrl: text("portfolio_url"),
  /** AI pre-screen: "pending" | "done" | "failed" */
  aiStatus: text("ai_status").notNull().default("pending"),
  aiScore: integer("ai_score"),
  aiVerdict: text("ai_verdict"),
  aiSummary: text("ai_summary"),
  /** AI-written drafts of the note sent with each decision (the admin edits before sending) */
  aiApproveMessage: text("ai_approve_message"),
  aiRejectMessage: text("ai_reject_message"),
  /** Shown to the applicant (required when rejecting) */
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("creator_applications_status_created_idx").on(t.status, t.createdAt),
  index("creator_applications_user_idx").on(t.userId, t.createdAt),
  check("creator_applications_status_check", sql`${t.status} IN ('pending', 'approved', 'rejected')`),
  check("creator_applications_ai_status_check", sql`${t.aiStatus} IN ('pending', 'done', 'failed')`),
]);

/** A sample wallpaper; applicationId is null while the form is still being filled in. */
export const creatorApplicationSamples = pgTable("creator_application_samples", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => creatorApplications.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  thumbUrl: text("thumb_url"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: integer("bytes").notNull(),
  position: integer("position").notNull().default(0),
  aiScore: integer("ai_score"),
  aiNote: text("ai_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("creator_application_samples_app_idx").on(t.applicationId),
  index("creator_application_samples_user_idx").on(t.userId),
]);
