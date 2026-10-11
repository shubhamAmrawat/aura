import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/db";
import { categories, users, wallpapers } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { generateWallpaperTextEmbedding } from "../../integrations/openai";
import { removeWallpaper } from "../wallpaperRemoval.service";

export type WallpaperListFilters = {
  q?: string;
  status: "all" | "approved" | "pending" | "rejected";
  categoryId?: string;
  uploader?: string;
  featured?: boolean;
  premium?: boolean;
  mobile?: boolean;
  ai?: boolean;
  resolution?: Resolution;
  sort: "newest" | "oldest" | "downloads" | "likes" | "views" | "trending" | "title";
  limit: number;
  offset: number;
};

/** Resolution tiers by the image's longer edge (works for portrait and landscape). */
export type Resolution = "4k" | "qhd" | "fhd" | "hd" | "low";
export const RESOLUTION_EDGES: Record<Resolution, [number, number | null]> = {
  "4k": [3840, null],
  qhd: [2560, 3840],
  fhd: [1920, 2560],
  hd: [1280, 1920],
  low: [0, 1280],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const listColumns = {
  id: wallpapers.id,
  title: wallpapers.title,
  fileUrl: wallpapers.fileUrl,
  dominantColor: wallpapers.dominantColor,
  width: wallpapers.width,
  height: wallpapers.height,
  fileSizeBytes: wallpapers.fileSizeBytes,
  format: wallpapers.format,
  status: wallpapers.status,
  tags: wallpapers.tags,
  isFeatured: wallpapers.isFeatured,
  isPremium: wallpapers.isPremium,
  isMobile: wallpapers.isMobile,
  isAiGenerated: wallpapers.isAiGenerated,
  downloadCount: wallpapers.downloadCount,
  likeCount: wallpapers.likeCount,
  viewCount: wallpapers.viewCount,
  trendingScore: wallpapers.trendingScore,
  createdAt: wallpapers.createdAt,
  categoryId: categories.id,
  categoryName: categories.name,
  uploaderId: users.id,
  uploaderUsername: users.username,
};

type ListRow = { [K in keyof typeof listColumns]: unknown };

function shape(r: ListRow) {
  const { categoryId, categoryName, uploaderId, uploaderUsername, ...rest } = r;
  return {
    ...rest,
    category: categoryId ? { id: categoryId as string, name: categoryName as string } : null,
    uploader: uploaderId ? { id: uploaderId as string, username: uploaderUsername as string } : null,
  };
}

function whereFor(f: WallpaperListFilters): SQL | undefined {
  const c: SQL[] = [];
  if (f.status !== "all") c.push(eq(wallpapers.status, f.status));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    const parts: SQL[] = [ilike(wallpapers.title, like), sql`array_to_string(${wallpapers.tags}, ' ') ILIKE ${like}`];
    if (UUID.test(f.q)) parts.push(eq(wallpapers.id, f.q));
    c.push(or(...parts)!);
  }
  if (f.categoryId === "none") c.push(isNull(wallpapers.categoryId));
  else if (f.categoryId) c.push(eq(wallpapers.categoryId, f.categoryId));
  if (f.uploader === "none") c.push(isNull(wallpapers.uploaderId));
  else if (f.uploader) c.push(ilike(users.username, `%${escapeLike(f.uploader.replace(/^@/, ""))}%`));
  if (f.featured !== undefined) c.push(eq(wallpapers.isFeatured, f.featured));
  if (f.premium !== undefined) c.push(eq(wallpapers.isPremium, f.premium));
  if (f.mobile !== undefined) c.push(eq(wallpapers.isMobile, f.mobile));
  if (f.ai !== undefined) c.push(eq(wallpapers.isAiGenerated, f.ai));
  if (f.resolution) {
    const [min, max] = RESOLUTION_EDGES[f.resolution];
    const edge = sql`greatest(${wallpapers.width}, ${wallpapers.height})`;
    c.push(max === null ? sql`${edge} >= ${min}` : sql`${edge} >= ${min} AND ${edge} < ${max}`);
  }
  return c.length ? and(...c) : undefined;
}

const ORDER = {
  newest: [desc(wallpapers.createdAt)],
  oldest: [asc(wallpapers.createdAt)],
  downloads: [desc(wallpapers.downloadCount), desc(wallpapers.createdAt)],
  likes: [desc(wallpapers.likeCount), desc(wallpapers.createdAt)],
  views: [desc(wallpapers.viewCount), desc(wallpapers.createdAt)],
  trending: [desc(wallpapers.trendingScore), desc(wallpapers.createdAt)],
  title: [asc(wallpapers.title)],
} as const;

/** Every wallpaper (any status), filtered + sorted, with uploader and category. */
export async function listWallpapers(f: WallpaperListFilters) {
  const where = whereFor(f);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(listColumns)
      .from(wallpapers)
      .leftJoin(categories, eq(categories.id, wallpapers.categoryId))
      .leftJoin(users, eq(users.id, wallpapers.uploaderId))
      .where(where)
      .orderBy(...ORDER[f.sort], asc(wallpapers.id))
      .limit(f.limit)
      .offset(f.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(wallpapers)
      .leftJoin(users, eq(users.id, wallpapers.uploaderId))
      .where(where) as unknown as Promise<[{ total: number }]>,
  ]);
  const data = rows.map((r) => shape(r as ListRow));
  return { data, total, hasMore: f.offset + data.length < total };
}

/** One wallpaper with everything an admin might need. */
export async function getWallpaperDetail(id: string) {
  const [row] = await db
    .select({
      ...listColumns,
      description: wallpapers.description,
      blurhash: wallpapers.blurhash,
      palette: wallpapers.palette,
      moderationReason: wallpapers.moderationReason,
      reviewNote: wallpapers.reviewNote,
      reviewedAt: wallpapers.reviewedAt,
      rejectedAt: wallpapers.rejectedAt,
      updatedAt: wallpapers.updatedAt,
      hasVisionEmbedding: sql<boolean>`${wallpapers.embedding} IS NOT NULL`,
      hasTextEmbedding: sql<boolean>`${wallpapers.textEmbedding} IS NOT NULL`,
    })
    .from(wallpapers)
    .leftJoin(categories, eq(categories.id, wallpapers.categoryId))
    .leftJoin(users, eq(users.id, wallpapers.uploaderId))
    .where(eq(wallpapers.id, id))
    .limit(1);
  if (!row) throw new ApiError(404, "Wallpaper not found");
  return shape(row as unknown as ListRow);
}

async function assertCategory(categoryId: string | null | undefined) {
  if (!categoryId) return;
  const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!c) throw new ApiError(400, "Category not found");
}

/** Re-create the search embedding after title/description/tags change (background). */
function reembedText(row: { id: string; title: string; description: string | null; tags: string[] }) {
  setImmediate(() => {
    generateWallpaperTextEmbedding({ title: row.title, description: row.description, tags: row.tags })
      .then(async (textEmbedding) => {
        if (textEmbedding) await db.update(wallpapers).set({ textEmbedding }).where(eq(wallpapers.id, row.id));
      })
      .catch((e) => console.error("[embedding] Re-embed after admin edit failed:", e));
  });
}

export type WallpaperPatch = {
  title?: string;
  description?: string | null;
  tags?: string[];
  categoryId?: string | null;
  isFeatured?: boolean;
  isPremium?: boolean;
  isMobile?: boolean;
  isAiGenerated?: boolean;
};

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);

/** Edit metadata/flags. Only changed fields are written and logged. */
export async function updateWallpaper(adminId: string, id: string, patch: WallpaperPatch) {
  const [current] = await db
    .select({
      id: wallpapers.id,
      title: wallpapers.title,
      description: wallpapers.description,
      tags: wallpapers.tags,
      categoryId: wallpapers.categoryId,
      isFeatured: wallpapers.isFeatured,
      isPremium: wallpapers.isPremium,
      isMobile: wallpapers.isMobile,
      isAiGenerated: wallpapers.isAiGenerated,
    })
    .from(wallpapers)
    .where(eq(wallpapers.id, id))
    .limit(1);
  if (!current) throw new ApiError(404, "Wallpaper not found");
  if (patch.categoryId !== undefined) await assertCategory(patch.categoryId);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(patch) as (keyof WallpaperPatch)[]) {
    const to = patch[key];
    if (to === undefined) continue;
    const from = current[key];
    const changed = key === "tags" ? !sameTags(from as string[], to as string[]) : from !== to;
    if (changed) changes[key] = { from, to };
  }

  if (Object.keys(changes).length === 0) return getWallpaperDetail(id);

  const set = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to]));
  await db.transaction(async (tx) => {
    await tx.update(wallpapers).set({ ...set, updatedAt: new Date() }).where(eq(wallpapers.id, id));
    await logAdminAction(
      { adminId, action: "wallpaper.update", targetType: "wallpaper", targetId: id, details: { title: patch.title ?? current.title, changes } },
      tx
    );
  });

  if ("title" in changes || "description" in changes || "tags" in changes) {
    reembedText({
      id,
      title: patch.title ?? current.title,
      description: patch.description !== undefined ? patch.description : current.description,
      tags: patch.tags ?? current.tags,
    });
  }
  return getWallpaperDetail(id);
}

/** Delete a wallpaper for good (row, likes, downloads, collections, R2 file). */
export async function deleteWallpaper(adminId: string, id: string) {
  const [row] = await db
    .select({ id: wallpapers.id, fileUrl: wallpapers.fileUrl, uploaderId: wallpapers.uploaderId, title: wallpapers.title })
    .from(wallpapers)
    .where(eq(wallpapers.id, id))
    .limit(1);
  if (!row) throw new ApiError(404, "Wallpaper not found");
  await removeWallpaper(row);
  await logAdminAction({ adminId, action: "wallpaper.delete", targetType: "wallpaper", targetId: id, details: { title: row.title, uploaderId: row.uploaderId } });
  return { id, deleted: true as const };
}

export type BulkAction = "feature" | "unfeature" | "setCategory" | "addTags" | "removeTags" | "delete";

/** Apply one action to many wallpapers; returns a result per id (one failure never stops the rest). */
export async function bulkUpdate(
  adminId: string,
  ids: string[],
  action: BulkAction,
  opts: { categoryId?: string | null; tags?: string[] }
) {
  const unique = [...new Set(ids)];
  if (action === "setCategory") await assertCategory(opts.categoryId ?? null);

  const existing = await db
    .select({ id: wallpapers.id, title: wallpapers.title, description: wallpapers.description, tags: wallpapers.tags })
    .from(wallpapers)
    .where(inArray(wallpapers.id, unique));
  const byId = new Map(existing.map((w) => [w.id, w]));

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of unique) {
    const w = byId.get(id);
    if (!w) {
      results.push({ id, ok: false, error: "Wallpaper not found" });
      continue;
    }
    try {
      if (action === "delete") {
        await deleteWallpaper(adminId, id);
      } else if (action === "feature" || action === "unfeature") {
        await updateWallpaper(adminId, id, { isFeatured: action === "feature" });
      } else if (action === "setCategory") {
        await updateWallpaper(adminId, id, { categoryId: opts.categoryId ?? null });
      } else {
        const want = opts.tags ?? [];
        const lower = new Set(want.map((t) => t.toLowerCase()));
        const next =
          action === "addTags"
            ? [...w.tags, ...want.filter((t) => !w.tags.some((x) => x.toLowerCase() === t.toLowerCase()))].slice(0, 30)
            : w.tags.filter((t) => !lower.has(t.toLowerCase()));
        await updateWallpaper(adminId, id, { tags: next });
      }
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof ApiError ? e.message : "Failed" });
    }
  }
  return { action, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
}
