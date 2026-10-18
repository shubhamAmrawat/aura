import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  index,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { users } from "./user.model";
import { categories, wallpapers } from "./wallpaper.model";

export const likes = pgTable("likes", {
  userId: uuid("user_id").notNull().references(() => users.id),
  wallpaperId: uuid("wallpaper_id").notNull().references(() => wallpapers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.wallpaperId] }),
}));

export const downloads = pgTable("downloads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  wallpaperId: uuid("wallpaper_id").notNull().references(() => wallpapers.id),
  quality: text("quality").notNull(),
  /** "web" | "mobile" | "unknown" — which client reported the download */
  source: text("source").notNull().default("unknown"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("downloads_created_at_idx").on(t.createdAt)]);

/** Views per wallpaper per day (Asia/Kolkata date) per client — for dashboard charts. */
export const wallpaperViewsDaily = pgTable("wallpaper_views_daily", {
  wallpaperId: uuid("wallpaper_id").notNull().references(() => wallpapers.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  source: text("source").notNull().default("unknown"),
  views: integer("views").notNull().default(0),
}, (t) => [
  primaryKey({ name: "wallpaper_views_daily_pk", columns: [t.wallpaperId, t.day, t.source] }),
  index("wallpaper_views_daily_day_idx").on(t.day),
]);

/** Categories a user picked after sign-up (max 4, enforced by the API); position 1 = first pick. */
export const userInterests = pgTable("user_interests", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.categoryId] }), index("user_interests_category_idx").on(t.categoryId)]);
