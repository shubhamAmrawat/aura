import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { categories, categoryRedirects } from "../models";

export function listCategories() {
  return db.select().from(categories).orderBy(categories.sortOrder);
}

/** Every old slug → the current slug of the category it now belongs to. */
export async function listCategoryRedirects(): Promise<Record<string, string>> {
  const rows = await db
    .select({ old: categoryRedirects.oldSlug, current: categories.slug })
    .from(categoryRedirects)
    .innerJoin(categories, eq(categories.id, categoryRedirects.categoryId));
  return Object.fromEntries(rows.map((r) => [r.old, r.current]));
}

/**
 * Category id for a slug — the current slug, or an old one kept after a rename/merge.
 * Returns the current slug too so callers can redirect.
 */
export async function resolveCategorySlug(slug: string): Promise<{ id: string; slug: string; redirected: boolean } | null> {
  const [cur] = await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(eq(categories.slug, slug)).limit(1);
  if (cur) return { ...cur, redirected: false };
  const [old] = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categoryRedirects)
    .innerJoin(categories, eq(categories.id, categoryRedirects.categoryId))
    .where(eq(categoryRedirects.oldSlug, slug))
    .limit(1);
  return old ? { ...old, redirected: true } : null;
}
