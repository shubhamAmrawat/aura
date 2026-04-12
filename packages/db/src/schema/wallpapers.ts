import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { users } from "./users";


export const wallpaperStatusEnum = pgEnum("wallpaper_status", [
  "pending",
  "approved",
  "rejected",
]);

export const wallpaperFormatEnum = pgEnum("wallpaper_format", [
  "jpeg",
  "png",
  "webp",
  "avif",
]);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const wallpapers = pgTable("wallpapers", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  cdnVariants: jsonb("cdn_variants"),
  blurhash: text("blurhash").notNull(),
  dominantColor: text("dominant_color").notNull(),
  palette: text("palette").array().notNull().default([]),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  format: wallpaperFormatEnum("format").notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  uploaderId: uuid("uploader_id").references(() => users.id),
  tags: text("tags").array().notNull().default([]),
  isPremium: boolean("is_premium").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  downloadCount: integer("download_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  trendingScore: real("trending_score").notNull().default(0),
  status: wallpaperStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});