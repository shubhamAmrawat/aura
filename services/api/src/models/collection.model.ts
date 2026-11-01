import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "./user.model";
import { wallpapers } from "./wallpaper.model";

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(true),
  coverWallpaperId: uuid("cover_wallpaper_id").references(() => wallpapers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** "user" = a user's own collection; "drop" = an admin's editorial drop (e.g. Diwali Drops) */
  kind: text("kind").$type<"user" | "drop">().notNull().default("user"),
  /** Drops only: banner window (UTC); null = open-ended */
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  /** Drops only: null = draft */
  publishedAt: timestamp("published_at"),
  showOnApp: boolean("show_on_app").notNull().default(true),
  showOnWeb: boolean("show_on_web").notNull().default(true),
});

export const collectionWallpapers = pgTable("collection_wallpapers", {
  collectionId: uuid("collection_id").notNull().references(() => collections.id),
  wallpaperId: uuid("wallpaper_id").notNull().references(() => wallpapers.id),
  sortOrder: integer("sort_order").notNull().default(0),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.collectionId, table.wallpaperId] }),
}));