import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./user.model";

/** Per-type switches for one phone (Settings › Notifications). Missing = the type's default. */
export type NotificationPrefs = Partial<Record<"drops" | "daily" | "updates" | "uploads" | "milestones" | "account", boolean>>;

/** A button on a notification: `id` matches the app's notification category, `url` is where it goes. */
export type NotificationAction = { id: string; label: string; url: string };

/** One phone that can get push (Expo push token). user_id null = signed out. */
export const pushDevices = pgTable("push_devices", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  platform: text("platform").notNull().default("android"),
  screen: text("screen").$type<"mobile" | "tablet">().notNull().default("mobile"),
  appVersion: text("app_version"),
  prefs: jsonb("prefs").$type<NotificationPrefs>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  disabledAt: timestamp("disabled_at"),
});

/** Inbox items. userId null = broadcast (everyone); set = personal. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    imageUrl: text("image_url"),
    /** path it opens (same on app and website), an https link, or null (= the inbox) */
    url: text("url"),
    actions: jsonb("actions").$type<NotificationAction[]>().notNull().default([]),
    /** broadcasts only: just this device shape */
    screen: text("screen").$type<"mobile" | "tablet">(),
    dedupeKey: text("dedupe_key").unique(),
    /** how many phones it was pushed to */
    pushed: integer("pushed").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)]
);

/** When each user last opened the inbox; items created before it count as seen. */
export const notificationSeen = pgTable("notification_seen", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  seenAt: timestamp("seen_at").notNull().defaultNow(),
});
