import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../config/db";
import { categories, wallpaperCategories } from "../models";
import { ApiError } from "../utils/ApiError";

/** A wallpaper has one primary category (wallpapers.category_id) and at most this many extras. */
export const MAX_EXTRA_CATEGORIES = 2;

const WALLPAPER_ID = sql.raw(`"wallpapers"."id"`);
const PRIMARY_ID = sql.raw(`"wallpapers"."category_id"`);

/** Wallpapers in a category — as their primary or as one of their extras. */
export function inCategorySql(categoryId: string): SQL {
  return sql`(${PRIMARY_ID} = ${categoryId} OR ${WALLPAPER_ID} IN (SELECT "wallpaper_id" FROM "wallpaper_categories" WHERE "category_id" = ${categoryId}))`;
}

/** Select column: the wallpaper's extra category ids (text[]). */
export const extraCategoryIdsSql = sql<string[]>`coalesce((SELECT array_agg("wc"."category_id"::text ORDER BY "wc"."created_at") FROM "wallpaper_categories" "wc" WHERE "wc"."wallpaper_id" = ${WALLPAPER_ID}), '{}')`;

/** Select column: the wallpaper's extra categories as [{ id, name }]. */
export const extraCategoriesSql = sql<{ id: string; name: string }[]>`coalesce((SELECT json_agg(json_build_object('id', "c"."id", 'name', "c"."name") ORDER BY "wc"."created_at") FROM "wallpaper_categories" "wc" JOIN "categories" "c" ON "c"."id" = "wc"."category_id" WHERE "wc"."wallpaper_id" = ${WALLPAPER_ID}), '[]'::json)`;

/**
 * Clean a requested list of extras: unique, not the primary, at most 2, every id must exist.
 * Throws a 400 the admin can read.
 */
export async function normalizeExtraCategories(ids: string[], primaryId: string | null): Promise<string[]> {
  const unique = [...new Set(ids)].filter((id) => id !== primaryId);
  if (unique.length > MAX_EXTRA_CATEGORIES) throw new ApiError(400, `A wallpaper can have at most ${MAX_EXTRA_CATEGORIES} extra categories.`);
  if (!unique.length) return [];
  const found = await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, unique));
  if (found.length !== unique.length) throw new ApiError(400, "Category not found");
  return unique;
}

type Executor = Pick<typeof db, "select" | "insert" | "delete">;

/** Current extras of a wallpaper (ids, in the order they were added). */
export async function getExtraCategoryIds(wallpaperId: string, tx: Executor = db): Promise<string[]> {
  const rows = await tx
    .select({ id: wallpaperCategories.categoryId })
    .from(wallpaperCategories)
    .where(eq(wallpaperCategories.wallpaperId, wallpaperId))
    .orderBy(wallpaperCategories.createdAt);
  return rows.map((r) => r.id);
}

/** Replace a wallpaper's extras with `ids` (already normalised). */
export async function setExtraCategories(wallpaperId: string, ids: string[], tx: Executor = db) {
  await tx.delete(wallpaperCategories).where(eq(wallpaperCategories.wallpaperId, wallpaperId));
  if (ids.length) await tx.insert(wallpaperCategories).values(ids.map((categoryId) => ({ wallpaperId, categoryId })));
}

/** Drop an extra that has become the wallpaper's primary category. */
export async function removeExtra(wallpaperId: string, categoryId: string, tx: Executor = db) {
  await tx.delete(wallpaperCategories).where(and(eq(wallpaperCategories.wallpaperId, wallpaperId), eq(wallpaperCategories.categoryId, categoryId)));
}
