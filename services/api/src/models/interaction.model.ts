import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./user.model";
import { wallpapers } from "./wallpaper.model";

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("downloads_created_at_idx").on(t.createdAt)]);