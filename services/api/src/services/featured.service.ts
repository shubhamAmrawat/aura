import { and, asc, desc, eq, sql } from "drizzle-orm";
import { visibleCategorySql, type ScreenFilter } from "../utils/screenFilter";
import { db } from "../config/db";
import { siteSettings, wallpapers } from "../models";
import { ApiError } from "../utils/ApiError";
import { logAdminAction } from "../utils/audit";
import { thumbUrlSql } from "./wallpaperThumb.service";

/**
 * Two independent featured lists, split by the wallpaper's shape:
 * - "web":    desktop (wide) wallpapers — the website's home page hero
 * - "mobile": phone wallpapers — the app's Featured row
 * A wallpaper is featured with one flag (is_featured); its shape decides which list it is in,
 * so the lists can never overlap. Each list has its own order and its own count.
 */
export type FeaturedList = "web" | "mobile";
export const FEATURED_LISTS: readonly FeaturedList[] = ["web", "mobile"];

/** Site-setting key holding each list's count (the web key predates the mobile list). */
export const FEATURED_LIMIT_KEYS: Record<FeaturedList, string> = { web: "featured.limit", mobile: "featured.mobile.limit" };
export const FEATURED_LIMIT_KEY = FEATURED_LIMIT_KEYS.web;
export const FEATURED_LIMIT_DEFAULT = 5;
export const FEATURED_LIMIT_MAX = 10;

/** Which list a wallpaper of this shape belongs to. */
export const listFor = (isMobile: boolean): FeaturedList => (isMobile ? "mobile" : "web");

/** Featured wallpapers in one list. */
const inList = (list: FeaturedList) => and(eq(wallpapers.isFeatured, true), eq(wallpapers.isMobile, list === "mobile"));

/** How many featured wallpapers a list shows (site setting, 1–10). */
export async function getFeaturedLimit(list: FeaturedList = "web"): Promise<number> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, FEATURED_LIMIT_KEYS[list])).limit(1);
  const n = Number(row?.value);
  return Number.isInteger(n) && n >= 1 && n <= FEATURED_LIMIT_MAX ? n : FEATURED_LIMIT_DEFAULT;
}

const publicColumns = {
  id: wallpapers.id,
  title: wallpapers.title,
  fileUrl: wallpapers.fileUrl,
  thumbUrl: thumbUrlSql,
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

/**
 * Public: one list in admin-chosen order, cut to its count.
 * `?screen=mobile` → the app's list; anything else (the website, older callers) → the website's list.
 */
export async function getPublicFeatured(screen: ScreenFilter | null = null) {
  const list: FeaturedList = screen === "mobile" ? "mobile" : "web";
  const limit = await getFeaturedLimit(list);
  const data = await db
    .select(publicColumns)
    .from(wallpapers)
    .where(and(inList(list), eq(wallpapers.status, "approved"), visibleCategorySql))
    .orderBy(...featuredOrderBy)
    .limit(limit);
  return { data, limit };
}

/** Admin: every wallpaper in one list (any status) in order, plus its count. */
export async function getAdminFeatured(list: FeaturedList = "web") {
  const [limit, items] = await Promise.all([
    getFeaturedLimit(list),
    db
      .select({
        id: wallpapers.id,
        title: wallpapers.title,
        fileUrl: wallpapers.fileUrl,
        thumbUrl: thumbUrlSql,
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
      .where(inList(list))
      .orderBy(...featuredOrderBy),
  ]);
  return { list, limit, maxLimit: FEATURED_LIMIT_MAX, items };
}

/** Next free position (end of its list) for a newly featured wallpaper of this shape. */
export async function nextFeaturedOrder(isMobile: boolean, executor: Pick<typeof db, "select"> = db): Promise<number> {
  const [{ max }] = (await executor
    .select({ max: sql<number | null>`max(${wallpapers.featuredOrder})` })
    .from(wallpapers)
    .where(inList(listFor(isMobile)))) as [{ max: number | null }];
  return (max ?? 0) + 1;
}

/** Save a new order for one list. `ids` must be exactly that list's current set (stale lists are refused). */
export async function setFeaturedOrder(adminId: string, ids: string[], list: FeaturedList = "web") {
  const current = await db.select({ id: wallpapers.id }).from(wallpapers).where(inList(list));
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
    await logAdminAction({ adminId, action: "featured.reorder", targetType: "featured", details: { list, order: ids } }, tx);
  });
  return getAdminFeatured(list);
}

/** Change how many featured wallpapers one list shows. */
export async function setFeaturedLimit(adminId: string, limit: number, list: FeaturedList = "web") {
  const key = FEATURED_LIMIT_KEYS[list];
  const before = await getFeaturedLimit(list);
  await db.transaction(async (tx) => {
    await tx
      .insert(siteSettings)
      .values({ key, value: limit, updatedAt: new Date(), updatedBy: adminId })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: limit, updatedAt: new Date(), updatedBy: adminId } });
    await logAdminAction({ adminId, action: "featured.limit", targetType: "settings", targetId: key, details: { list, from: before, to: limit } }, tx);
  });
  return getAdminFeatured(list);
}
