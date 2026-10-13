import { and, asc, eq, max, ne, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { categories, categoryRedirects, wallpapers } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { keyFromPublicUrl } from "../../integrations/r2";
import { deleteThumbFile, refreshCategoryThumb } from "../categoryThumb.service";

/** "Sci-Fi & Fantasy" → "sci-fi-fantasy" */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

// Correlated subqueries: the outer column must be table-qualified — drizzle renders a bare
// "id" inside select(), which would silently resolve to wallpapers.id.
const CAT_ID = sql.raw(`"categories"."id"`);
const total = sql<number>`(SELECT count(*)::int FROM wallpapers w WHERE w.category_id = ${CAT_ID})`;
const live = sql<number>`(SELECT count(*)::int FROM wallpapers w WHERE w.category_id = ${CAT_ID} AND w.status = 'approved')`;
/** What the category looks like: its cover, else its most downloaded live wallpaper. */
const preview = sql<string | null>`COALESCE(${sql.raw(`"categories"."cover_image_url"`)}, (
  SELECT w.file_url FROM wallpapers w
  WHERE w.category_id = ${CAT_ID} AND w.status = 'approved'
  ORDER BY w.download_count DESC, w.created_at DESC LIMIT 1))`;

export async function listAdminCategories() {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      intro: categories.intro,
      coverImageUrl: categories.coverImageUrl,
      sortOrder: categories.sortOrder,
      isHidden: categories.isHidden,
      total,
      live,
      previewUrl: preview,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return { data: rows };
}

async function getOne(id: string) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!row) throw new ApiError(404, "Category not found");
  return row;
}

/** Name and slug must both be unique (name case-insensitively). */
async function assertUnique(name: string | undefined, slug: string | undefined, exceptId?: string) {
  if (name !== undefined) {
    const [hit] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(sql`lower(${categories.name}) = lower(${name})`, exceptId ? ne(categories.id, exceptId) : undefined))
      .limit(1);
    if (hit) throw new ApiError(409, "A category with this name already exists.");
  }
  if (slug !== undefined) {
    const [hit] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, slug), exceptId ? ne(categories.id, exceptId) : undefined))
      .limit(1);
    if (hit) throw new ApiError(409, "A category with this slug already exists.");
  }
}

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505" || (e as { cause?: { code?: string } })?.cause?.code === "23505";

export async function createCategory(adminId: string, input: { name: string; slug?: string; description?: string | null }) {
  const slug = input.slug ?? slugify(input.name);
  if (slug.length < 2) throw new ApiError(400, "Add a slug — the name has too few letters or numbers to make one.");
  await assertUnique(input.name, slug);
  try {
    const row = await db.transaction(async (tx) => {
      const [m] = await tx.select({ m: max(categories.sortOrder) }).from(categories);
      await tx.delete(categoryRedirects).where(eq(categoryRedirects.oldSlug, slug)); // the slug is in use again
      const [created] = await tx
        .insert(categories)
        .values({ name: input.name, slug, description: input.description ?? null, sortOrder: (m?.m ?? -1) + 1 })
        .returning();
      await logAdminAction({ adminId, action: "category.create", targetType: "category", targetId: created!.id, details: { name: created!.name, slug } }, tx);
      return created!;
    });
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "A category with this slug already exists.");
    throw e;
  }
}

export async function updateCategory(
  adminId: string,
  id: string,
  patch: { name?: string; slug?: string; description?: string | null; intro?: string | null; coverImageUrl?: string | null; isHidden?: boolean }
) {
  const before = await getOne(id);
  if (patch.coverImageUrl && !keyFromPublicUrl(patch.coverImageUrl)) {
    throw new ApiError(400, "The cover must be an image hosted on Aurora.");
  }
  await assertUnique(patch.name, patch.slug, id);

  const set: Partial<typeof categories.$inferInsert> = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of ["name", "slug", "description", "intro", "coverImageUrl", "isHidden"] as const) {
    if (patch[k] !== undefined && patch[k] !== before[k]) {
      (set as Record<string, unknown>)[k] = patch[k];
      changes[k] = { from: before[k], to: patch[k] };
    }
  }
  if (!Object.keys(set).length) return before;
  let updated: typeof before;
  try {
    updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(categories).set(set).where(eq(categories.id, id)).returning();
      if (set.slug) {
        // Old links keep working: /category/<old> → this category
        await tx.delete(categoryRedirects).where(eq(categoryRedirects.oldSlug, set.slug));
        await tx
          .insert(categoryRedirects)
          .values({ oldSlug: before.slug, categoryId: id })
          .onConflictDoUpdate({ target: categoryRedirects.oldSlug, set: { categoryId: id, createdAt: new Date() } });
      }
      await logAdminAction({ adminId, action: "category.update", targetType: "category", targetId: id, details: { changes } }, tx);
      return row!;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "A category with this slug already exists.");
    throw e;
  }
  if (changes.coverImageUrl) {
    // New cover → new menu thumbnail. A failure here must not fail the save.
    try {
      await refreshCategoryThumb(id);
      return await getOne(id);
    } catch (e) {
      console.error("[category-thumbs] refresh after cover change failed:", e instanceof Error ? e.message : e);
    }
  }
  return updated;
}

/** Save the full display order (the client sends every category id, top to bottom). */
export async function reorderCategories(adminId: string, ids: string[]) {
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new ApiError(400, "The list contains duplicates.");
  const current = await db.select({ id: categories.id }).from(categories);
  if (current.length !== ids.length || current.some((c) => !unique.has(c.id))) {
    throw new ApiError(409, "The category list changed. Refresh and try again.");
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(categories).set({ sortOrder: i }).where(eq(categories.id, ids[i]!));
    }
    await logAdminAction({ adminId, action: "category.reorder", targetType: "category", details: { order: ids } }, tx);
  });
  return listAdminCategories();
}

/**
 * Delete a category. If it still has wallpapers they must be moved first (`moveTo`) —
 * this doubles as "merge into another category". Moving + deleting is one transaction.
 */
export async function deleteCategory(adminId: string, id: string, moveTo?: string) {
  const cat = await getOne(id);
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(wallpapers)
    .where(eq(wallpapers.categoryId, id));

  let target: { id: string; name: string } | null = null;
  if (moveTo !== undefined) {
    if (moveTo === id) throw new ApiError(400, "Pick a different category to move the wallpapers to.");
    const [t] = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.id, moveTo)).limit(1);
    if (!t) throw new ApiError(400, "The category to move wallpapers to was not found.");
    target = t;
  }
  if (n > 0 && !target) {
    throw new ApiError(409, `This category has ${n} wallpaper${n === 1 ? "" : "s"}. Choose a category to move them to.`);
  }

  const moved = await db.transaction(async (tx) => {
    let count = 0;
    if (target) {
      const res = await tx.update(wallpapers).set({ categoryId: target.id }).where(eq(wallpapers.categoryId, id)).returning({ id: wallpapers.id });
      count = res.length;
      // Merged: /category/<deleted slug> (and its older slugs) now lead to the target
      await tx.update(categoryRedirects).set({ categoryId: target.id }).where(eq(categoryRedirects.categoryId, id));
      await tx
        .insert(categoryRedirects)
        .values({ oldSlug: cat.slug, categoryId: target.id })
        .onConflictDoUpdate({ target: categoryRedirects.oldSlug, set: { categoryId: target.id, createdAt: new Date() } });
    }
    await tx.delete(categories).where(eq(categories.id, id));
    await logAdminAction(
      { adminId, action: "category.delete", targetType: "category", targetId: id, details: { name: cat.name, slug: cat.slug, moved: count, moveTo: target?.id ?? null, moveToName: target?.name ?? null } },
      tx
    );
    return count;
  });
  await deleteThumbFile(cat.coverThumbUrl);
  return { id, deleted: true as const, moved, moveTo: target?.id ?? null };
}
