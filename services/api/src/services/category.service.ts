import { and, eq } from "drizzle-orm";
import { db } from "../config/db";
import { categories, categoryRedirects } from "../models";
import { liveCount } from "./categoryThumb.service";

/** Public list (hidden categories left out): display order, with a small cover thumbnail and the number of live wallpapers. */
export function listCategories() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      coverImageUrl: categories.coverImageUrl,
      coverThumbUrl: categories.coverThumbUrl,
      sortOrder: categories.sortOrder,
      wallpaperCount: liveCount,
    })
    .from(categories)
    .where(eq(categories.isHidden, false))
    .orderBy(categories.sortOrder);
}

/** Every old slug → the current slug of the category it now belongs to. */
export async function listCategoryRedirects(): Promise<Record<string, string>> {
  const rows = await db
    .select({ old: categoryRedirects.oldSlug, current: categories.slug })
    .from(categoryRedirects)
    .innerJoin(categories, eq(categories.id, categoryRedirects.categoryId))
    .where(eq(categories.isHidden, false));
  return Object.fromEntries(rows.map((r) => [r.old, r.current]));
}

/**
 * Category id for a slug (hidden categories count as not found) — the current slug, or an old one kept after a rename/merge.
 * Returns the current slug too so callers can redirect.
 */
const details = { id: categories.id, slug: categories.slug, name: categories.name, description: categories.description, intro: categories.intro };

export async function resolveCategorySlug(slug: string): Promise<{
  id: string; slug: string; name: string; description: string | null; intro: string | null; redirected: boolean;
} | null> {
  const [cur] = await db.select(details).from(categories).where(and(eq(categories.slug, slug), eq(categories.isHidden, false))).limit(1);
  if (cur) return { ...cur, redirected: false };
  const [old] = await db
    .select(details)
    .from(categoryRedirects)
    .innerJoin(categories, eq(categories.id, categoryRedirects.categoryId))
    .where(and(eq(categoryRedirects.oldSlug, slug), eq(categories.isHidden, false)))
    .limit(1);
  return old ? { ...old, redirected: true } : null;
}
