import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { wallpapers } from "./wallpapers";

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(true),
  coverWallpaperId: uuid("cover_wallpaper_id").references(() => wallpapers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const collectionWallpapers = pgTable("collection_wallpapers", {
  collectionId: uuid("collection_id").notNull().references(() => collections.id),
  wallpaperId: uuid("wallpaper_id").notNull().references(() => wallpapers.id),
  sortOrder: integer("sort_order").notNull().default(0),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.collectionId, table.wallpaperId] }),
}));