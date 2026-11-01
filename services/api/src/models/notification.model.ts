import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
  /** the phone's name, e.g. "Pixel 8" (set by the user in Android) */
  deviceName: text("device_name"),
  osVersion: text("os_version"),
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
    campaignId: uuid("campaign_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)]
);

/** When each user last opened the inbox; items created before it count as seen. */
export const notificationSeen = pgTable("notification_seen", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  seenAt: timestamp("seen_at").notNull().defaultNow(),
});

/** Who a campaign goes to. */
export type CampaignAudience = {
  kind: "everyone" | "signedIn" | "signedOut" | "creators" | "admins" | "users" | "devices";
  /** kind "users": these accounts (all their phones and browsers) */
  userIds?: string[];
  /** kind "devices": exact app tokens / web endpoints */
  targets?: string[];
  screen?: "mobile" | "tablet" | null;
  /** only apps older than this version */
  versionBelow?: string | null;
  /** phones seen in the last N days (positive) or not seen for N days (negative) */
  activeDays?: number | null;
  /** also browsers that turned on website notifications */
  includeWeb?: boolean;
  /** only for broadcast-type inbox rows: show to everyone's inbox */
  inbox?: boolean;
};

export type CampaignStatus = "scheduled" | "held" | "sending" | "sent" | "cancelled";

/** One send: manual (admin), automatic (drop, upload approved…) or a test. */
export const notificationCampaigns = pgTable("notification_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").$type<"manual" | "auto" | "test">().notNull().default("manual"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  imageUrl: text("image_url"),
  url: text("url"),
  actions: jsonb("actions").$type<NotificationAction[]>().notNull().default([]),
  audience: jsonb("audience").$type<CampaignAudience>().notNull(),
  respectQuiet: boolean("respect_quiet").notNull().default(true),
  status: text("status").$type<CampaignStatus>().notNull().default("scheduled"),
  scheduledFor: timestamp("scheduled_for").notNull().defaultNow(),
  dedupeKey: text("dedupe_key").unique(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  targeted: integer("targeted").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  delivered: integer("delivered").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  capped: integer("capped").notNull().default(0),
  opened: integer("opened").notNull().default(0),
});

export type DeliveryStatus = "queued" | "sent" | "delivered" | "failed" | "capped";

/** One campaign → one phone (app token) or browser (web push endpoint). */
export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => notificationCampaigns.id, { onDelete: "cascade" }),
  channel: text("channel").$type<"app" | "web">().notNull(),
  target: text("target").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").$type<DeliveryStatus>().notNull().default("queued"),
  ticketId: text("ticket_id"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  checkedAt: timestamp("checked_at"),
  openedAt: timestamp("opened_at"),
  action: text("action"),
});

/** A browser that turned on website notifications (Web Push). */
export const webPushSubscriptions = pgTable("web_push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  userAgent: text("user_agent"),
  prefs: jsonb("prefs").$type<NotificationPrefs>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  disabledAt: timestamp("disabled_at"),
});
