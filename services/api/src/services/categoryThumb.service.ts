import crypto from "node:crypto";
import sharp from "sharp";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../config/db";
import { categories, wallpapers } from "../models";
import { deleteFile, getFileBytes, keyFromPublicUrl, uploadFileToKey } from "../integrations/r2";

/** 3:2 webp, sized for menus and tiles (shown at up to ~240 css px wide). */
const THUMB = { width: 480, height: 320, quality: 72 };

/** The image a category's thumbnail is made from: its cover, else its most downloaded live wallpaper. */
export async function thumbSourceFor(categoryId: string): Promise<string | null> {
  const [cat] = await db
    .select({ cover: categories.coverImageUrl })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (!cat) return null;
  if (cat.cover) return cat.cover;
  const [top] = await db
    .select({ url: wallpapers.fileUrl })
    .from(wallpapers)
    .where(and(eq(wallpapers.categoryId, categoryId), eq(wallpapers.status, "approved")))
    .orderBy(desc(wallpapers.downloadCount), desc(wallpapers.createdAt))
    .limit(1);
  return top?.url ?? null;
}

export async function renderThumb(image: Buffer): Promise<Buffer> {
  return sharp(image, { failOn: "none" })
    .rotate()
    .resize(THUMB.width, THUMB.height, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: THUMB.quality })
    .toBuffer();
}

export type ThumbResult = "created" | "unchanged" | "cleared" | "skipped";

/**
 * Make (or remake) a category's thumbnail when its source image changed.
 * The old thumbnail object is left in place: pages cached with its URL keep working.
 */
export async function refreshCategoryThumb(categoryId: string, opts: { force?: boolean } = {}): Promise<ThumbResult> {
  const [cat] = await db
    .select({ thumb: categories.coverThumbUrl, source: categories.coverThumbSource })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (!cat) return "skipped";

  const source = await thumbSourceFor(categoryId);
  if (!source) {
    if (!cat.thumb) return "unchanged";
    await db.update(categories).set({ coverThumbUrl: null, coverThumbSource: null }).where(eq(categories.id, categoryId));
    return "cleared";
  }
  if (!opts.force && cat.thumb && cat.source === source) return "unchanged";

  const key = keyFromPublicUrl(source);
  if (!key) return "skipped"; // not one of our files
  const webp = await renderThumb(await getFileBytes(key));
  const hash = crypto.createHash("sha1").update(source).digest("hex").slice(0, 10);
  const url = await uploadFileToKey(`categories/thumbs/${categoryId}-${hash}.webp`, webp, "image/webp");
  await db.update(categories).set({ coverThumbUrl: url, coverThumbSource: source }).where(eq(categories.id, categoryId));
  return "created";
}

/**
 * Fill in thumbnails that are missing (new categories, or ones that just got their first wallpaper).
 * Existing thumbnails are not swapped when download ranks change, so menus stay stable;
 * they change when an admin sets a cover (or via scripts/category-thumbs.mts --force).
 */
export async function fillMissingCategoryThumbs(): Promise<{ created: number; failed: number }> {
  const rows = await db.select({ id: categories.id }).from(categories).where(isNull(categories.coverThumbUrl));
  let created = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      if ((await refreshCategoryThumb(r.id)) === "created") created++;
    } catch (e) {
      failed++;
      console.error(`[category-thumbs] ${r.id}:`, e instanceof Error ? e.message : e);
    }
  }
  return { created, failed };
}

/** Remove a deleted category's thumbnail file (best effort). */
export async function deleteThumbFile(url: string | null | undefined): Promise<void> {
  const key = keyFromPublicUrl(url);
  if (!key || !key.startsWith("categories/thumbs/")) return;
  await deleteFile(key).catch((e) => console.error("[category-thumbs] delete failed:", e instanceof Error ? e.message : e));
}

/** Live wallpaper count per category, for the public list. */
export const liveCount = sql<number>`(SELECT count(*)::int FROM wallpapers w WHERE w.category_id = ${sql.raw(`"categories"."id"`)} AND w.status = 'approved')`;
