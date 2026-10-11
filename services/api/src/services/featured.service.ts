import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../config/db";
import { siteSettings, wallpapers } from "../models";
import { ApiError } from "../utils/ApiError";
import { logAdminAction } from "../utils/audit";

export const FEATURED_LIMIT_KEY = "featured.limit";
export const FEATURED_LIMIT_DEFAULT = 5;
export const FEATURED_LIMIT_MAX = 10;

/** How many featured wallpapers the home page shows (site setting, 1–10). */
export async function getFeaturedLimit(): Promise<number> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, FEATURED_LIMIT_KEY)).limit(1);
  const n = Number(row?.value);
  return Number.isInteger(n) && n >= 1 && n <= FEATURED_LIMIT_MAX ? n : FEATURED_LIMIT_DEFAULT;
}

const publicColumns = {
  id: wallpapers.id,
  title: wallpapers.title,
  fileUrl: wallpapers.fileUrl,
  blurhash: wallpapers.blurhash,
  dominantColor: wallpapers.dominantColor,
  palette: wallpapers.palette,
  width: wallpapers.width,
  height: wallpapers.height,
  likeCount: wallpapers.likeCount,
  downloadCount: wallpapers.downloadCount,
  viewCount: wallpapers.viewCount,
  trendingScore: wallpapers.trendingScore,
  isFeatured: wallpapers.isFeatured,
  isPremium: wallpapers.isPremium,
  isMobile: wallpapers.isMobile,
  tags: wallpapers.tags,
  categoryId: wallpapers.categoryId,
  status: wallpapers.status,
  createdAt: wallpapers.createdAt,
  format: wallpapers.format,
  fileSizeBytes: wallpapers.fileSizeBytes,
};

const featuredOrderBy = [sql`${wallpapers.featuredOrder} ASC NULLS LAST`, desc(wallpapers.createdAt), asc(wallpapers.id)];

/** Public: the home page hero, in admin-chosen order, cut to the configured limit. */
export async function getPublicFeatured() {
  const limit = await getFeaturedLimit();
  const data = await db
    .select(publicColumns)
    .from(wallpapers)
    .where(and(eq(wallpapers.isFeatured, true), eq(wallpapers.status, "approved")))
    .orderBy(...featuredOrderBy)
    .limit(limit);
  return { data, limit };
}

/** Admin: every featured wallpaper (any status) in order, plus the limit. */
export async function getAdminFeatured() {
  const [limit, items] = await Promise.all([
    getFeaturedLimit(),
    db
      .select({
        id: wallpapers.id,
        title: wallpapers.title,
        fileUrl: wallpapers.fileUrl,
        dominantColor: wallpapers.dominantColor,
        width: wallpapers.width,
        height: wallpapers.height,
        format: wallpapers.format,
        tags: wallpapers.tags,
        status: wallpapers.status,
        isMobile: wallpapers.isMobile,
        featuredOrder: wallpapers.featuredOrder,
        createdAt: wallpapers.createdAt,
      })
      .from(wallpapers)
      .where(eq(wallpapers.isFeatured, true))
      .orderBy(...featuredOrderBy),
  ]);
  return { limit, maxLimit: FEATURED_LIMIT_MAX, items };
}

/** Next free position (end of the list) for a newly featured wallpaper. */
export async function nextFeaturedOrder(executor: Pick<typeof db, "select"> = db): Promise<number> {
  const [{ max }] = (await executor
    .select({ max: sql<number | null>`max(${wallpapers.featuredOrder})` })
    .from(wallpapers)
    .where(eq(wallpapers.isFeatured, true))) as [{ max: number | null }];
  return (max ?? 0) + 1;
}

/** Save a new order. `ids` must be exactly the current featured set (stale lists are refused). */
export async function setFeaturedOrder(adminId: string, ids: string[]) {
  const current = await db.select({ id: wallpapers.id }).from(wallpapers).where(eq(wallpapers.isFeatured, true));
  const currentSet = new Set(current.map((r) => r.id));
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new ApiError(400, "The list contains duplicates.");
  if (unique.size !== currentSet.size || ids.some((id) => !currentSet.has(id))) {
    throw new ApiError(409, "The featured list changed. Refresh and try again.");
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(wallpapers).set({ featuredOrder: i + 1 }).where(eq(wallpapers.id, ids[i]!));
    }
    await logAdminAction({ adminId, action: "featured.reorder", targetType: "featured", details: { order: ids } }, tx);
  });
  return getAdminFeatured();
}

/** Change how many featured wallpapers the home page shows. */
export async function setFeaturedLimit(adminId: string, limit: number) {
  const before = await getFeaturedLimit();
  await db.transaction(async (tx) => {
    await tx
      .insert(siteSettings)
      .values({ key: FEATURED_LIMIT_KEY, value: limit, updatedAt: new Date(), updatedBy: adminId })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: limit, updatedAt: new Date(), updatedBy: adminId } });
    await logAdminAction({ adminId, action: "featured.limit", targetType: "settings", targetId: FEATURED_LIMIT_KEY, details: { from: before, to: limit } }, tx);
  });
  return getAdminFeatured();
}
