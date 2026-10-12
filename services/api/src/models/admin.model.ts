import { pgTable, uuid, text, jsonb, timestamp, index, real, boolean } from "drizzle-orm/pg-core";
import { users } from "./user.model";
import { categories, wallpapers } from "./wallpaper.model";

/** Small key/value settings changed from the admin dashboard (e.g. featured.limit). */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

/** Audit log: one row per admin change (who, what, on which record, details). */
export const adminActions = pgTable("admin_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("admin_actions_created_at_idx").on(t.createdAt)]);

/** Old category slugs (renamed or merged away) → the category they now point to. */
export const categoryRedirects = pgTable("category_redirects", {
  oldSlug: text("old_slug").primaryKey(),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** AI category suggestion per wallpaper, reviewed in the admin dashboard. */
export const categorySuggestions = pgTable(
  "category_suggestions",
  {
    wallpaperId: uuid("wallpaper_id").primaryKey().references(() => wallpapers.id, { onDelete: "cascade" }),
    currentCategoryId: uuid("current_category_id").references(() => categories.id, { onDelete: "set null" }),
    suggestedCategoryId: uuid("suggested_category_id").references(() => categories.id, { onDelete: "set null" }),
    alternativeCategoryId: uuid("alternative_category_id").references(() => categories.id, { onDelete: "set null" }),
    confidence: real("confidence").notNull(),
    currentFits: boolean("current_fits"),
    newCategoryIdea: text("new_category_idea"),
    reason: text("reason"),
    model: text("model").notNull(),
    /** pending | applied | auto_applied | dismissed */
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("category_suggestions_status_idx").on(t.status)]
);
