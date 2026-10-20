import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../config/db";
import { categories, downloads, users, wallpapers } from "../models";
import { ApiError } from "../utils/ApiError";
import { screenFilterSql, visibleCategoryFilterSql, visibleCategorySql, type ScreenFilter } from "../utils/screenFilter";
import { checkImageSafety } from "../integrations/sightengine";
import { deleteFile, generateUploadUrl } from "../integrations/r2";
import { generateVisionEmbedding, generateWallpaperTextEmbedding } from "../integrations/openai";
import type { UploadInput } from "../validators/wallpaper.schema";
import { resolveCategorySlug } from "./category.service";
import { extraCategoryIdsSql, inCategorySql } from "./wallpaperCategories.service";
import { deleteThumbFor, prepareUploadedImage, thumbUrlSql, type ThumbVariant } from "./wallpaperThumb.service";
import { embedWallpaper } from "./uploadAi.service";
import { findImageDuplicate, type DuplicateMatch } from "./duplicate.service";
import { duplicateError, getCreatorDraft } from "./creatorUpload.service";
import { normalizeExtraCategories, setExtraCategories } from "./wallpaperCategories.service";
import { uploadDrafts } from "../models";
import { creatorIdColumnSql, creatorIdSql } from "../utils/creatorId";

/** Columns returned by every list/feed endpoint. */
export const wallpaperListSelect = {
  id: wallpapers.id,
  title: wallpapers.title,
  fileUrl: wallpapers.fileUrl,
  /** 600px WebP for grids (null until made); fileUrl is the full original. */
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
  /** Uploader's id when a creator (not an admin) uploaded it — lets the app hide blocked creators */
  creatorId: creatorIdSql,
};

function screenCondition(filter: ScreenFilter | null) {
  if (filter === "mobile") return eq(wallpapers.isMobile, true);
  if (filter === "tablet") return eq(wallpapers.isMobile, false);
  return undefined;
}

// ─── Feeds ─────────────────────────────────────────────────

export async function listWallpapers(params: {
  featured: boolean;
  limit: number;
  offset: number;
  categorySlug?: string;
  q?: string;
  screen: ScreenFilter | null;
}) {
  const conditions = [eq(wallpapers.status, "approved"), visibleCategorySql];
  if (params.featured) conditions.push(eq(wallpapers.isFeatured, true));

  if (params.categorySlug) {
    const catRow = await resolveCategorySlug(params.categorySlug); // follows renamed/merged slugs
    conditions.push(catRow ? inCategorySql(catRow.id) : sql`1 = 0`); // primary or extra category
  }

  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(
      or(
        ilike(wallpapers.title, pattern),
        ilike(wallpapers.description, pattern),
        sql`array_to_string(${wallpapers.tags}, ' ') ILIKE ${pattern}`
      )!
    );
  }
  const screen = screenCondition(params.screen);
  if (screen) conditions.push(screen);

  return db
    .select(wallpaperListSelect)
    .from(wallpapers)
    .where(and(...conditions))
    .orderBy(desc(wallpapers.createdAt))
    .limit(params.limit)
    .offset(params.offset);
}

export async function listTrending(params: { limit: number; offset: number; screen: ScreenFilter | null }) {
  const conditions = [eq(wallpapers.status, "approved"), visibleCategorySql];
  const screen = screenCondition(params.screen);
  if (screen) conditions.push(screen);

  return db
    .select(wallpaperListSelect)
    .from(wallpapers)
    .where(and(...conditions))
    .orderBy(desc(wallpapers.trendingScore))
    .limit(params.limit)
    .offset(params.offset);
}

/** Remove admin-only review fields before a wallpaper goes into a public response. */
export function withoutReviewFields<T extends Partial<typeof wallpapers.$inferSelect>>(row: T) {
  const { moderationReason: _r, reviewedBy: _b, reviewedAt: _a, rejectedAt: _j, reviewNote: _n, featuredOrder: _o, phash: _p, ...rest } = row;
  return rest;
}

/** True when an admin has hidden the wallpaper's primary category or one of its extra categories. */
async function inHiddenCategory(wallpaperId: string, categoryId: string | null) {
  const [extra] = await db.execute<{ hidden: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM wallpaper_categories wc JOIN categories c ON c.id = wc.category_id
                   WHERE wc.wallpaper_id = ${wallpaperId}::uuid AND c.is_hidden) AS hidden`);
  if (extra?.hidden) return true;
  return inHiddenPrimary(categoryId);
}

async function inHiddenPrimary(categoryId: string | null) {
  if (!categoryId) return false;
  const [cat] = await db.select({ isHidden: categories.isHidden }).from(categories).where(eq(categories.id, categoryId)).limit(1);
  return cat?.isHidden === true;
}

/** Public profile of the uploader when it's a creator; null for admin uploads (shown without a name). */
async function getCreator(uploaderId: string | null) {
  if (!uploaderId) return null;
  const [u] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, role: users.role })
    .from(users)
    .where(eq(users.id, uploaderId))
    .limit(1);
  if (!u || u.role === "admin") return null;
  const { role: _role, ...creator } = u;
  return creator;
}

/** Single wallpaper (any status), without the large textEmbedding vector. */
export async function getWallpaper(id: string) {
  const [record] = await db.select().from(wallpapers).where(eq(wallpapers.id, id)).limit(1);
  if (!record || record.status === "hidden") throw new ApiError(404, "Wallpaper not found"); // hidden = uploader disabled
  if (await inHiddenCategory(record.id, record.categoryId)) throw new ApiError(404, "Wallpaper not found");
  const [{ extraCategoryIds } = { extraCategoryIds: [] as string[] }] = await db
    .select({ extraCategoryIds: extraCategoryIdsSql })
    .from(wallpapers)
    .where(eq(wallpapers.id, record.id));
  const { textEmbedding: _textEmbedding, ...rest } = record;
  const wallpaper = { ...rest, extraCategoryIds, creator: await getCreator(record.uploaderId) };
  return withoutReviewFields(wallpaper);
}

/**
 * Hybrid similarity: 0.75 × cosine + 0.15 same-category bonus + 0.10 × tag Jaccard.
 * Fetches limit+1 rows to compute hasMore. Returns null when the source has no embedding.
 */
export async function getSimilar(id: string, params: { limit: number; offset: number; screen: ScreenFilter | null }) {
  const [src] = await db.select().from(wallpapers).where(eq(wallpapers.id, id)).limit(1);
  if (!src || src.status === "hidden" || (await inHiddenCategory(src.id, src.categoryId))) throw new ApiError(404, "Wallpaper not found");
  if (!src.textEmbedding) return null; // caller responds with an empty, uncached result

  const embeddingStr = `[${src.textEmbedding.join(",")}]`;

  // JS string[] must become SQL text[] — binding ${src.tags} alone sends a scalar string (22P02).
  const tagList = src.tags ?? [];
  const sourceTagsSql =
    tagList.length === 0
      ? sql`ARRAY[]::text[]`
      : sql`ARRAY[${sql.join(
          tagList.map((t) => sql`${t}`),
          sql`, `
        )}]::text[]`;

  const categoryBonusSql =
    src.categoryId == null
      ? sql`0`
      : sql`CASE WHEN category_id = ${src.categoryId}::uuid THEN 0.15 ELSE 0 END`;

  const similar = await db.execute(sql`
    SELECT 
      id, title, description, file_url, cdn_variants->'thumb'->>'url' AS thumb_url, blurhash, dominant_color,
      palette, width, height, like_count, download_count, view_count,
      format, file_size_bytes,
      category_id, tags, ${creatorIdColumnSql},
      (1 - (text_embedding <=> ${embeddingStr}::vector)) AS semantic_score,
      ${categoryBonusSql} AS category_bonus,
      (
        (1 - (text_embedding <=> ${embeddingStr}::vector)) * 0.75 +
        ${categoryBonusSql} +
        (
          CARDINALITY(ARRAY(
            SELECT UNNEST(tags::text[])
            INTERSECT
            SELECT UNNEST(${sourceTagsSql})
          ))::float /
          GREATEST(
            CARDINALITY(ARRAY(
              SELECT UNNEST(tags::text[])
              UNION
              SELECT UNNEST(${sourceTagsSql})
            )),
            1
          )
        ) * 0.10
      ) AS hybrid_score
    FROM wallpapers
    WHERE 
      status = 'approved'
      AND id != ${id}
      AND text_embedding IS NOT NULL
      ${screenFilterSql(params.screen)}
      ${visibleCategoryFilterSql}
    ORDER BY hybrid_score DESC
    LIMIT ${params.limit + 1}
    OFFSET ${params.offset}
  `);

  const rows = [...similar];
  const hasMore = rows.length > params.limit;
  return { data: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}

/** Count a view (approved wallpapers only). */
/** Which client reported a view/download. Anything else is stored as "unknown". */
export type ClientSource = "web" | "mobile" | "unknown";
export const toClientSource = (v: unknown): ClientSource => (v === "web" || v === "mobile" ? v : "unknown");

/** Count a view: the public counter + the daily log (IST date) used by the dashboard. */
export async function trackView(id: string, source: ClientSource = "unknown") {
  const updated = await db
    .update(wallpapers)
    .set({ viewCount: sql`${wallpapers.viewCount} + 1` })
    .where(and(eq(wallpapers.id, id), eq(wallpapers.status, "approved")))
    .returning({ id: wallpapers.id });
  if (updated.length === 0) return;
  await db.execute(sql`
    INSERT INTO wallpaper_views_daily (wallpaper_id, day, source, views)
    VALUES (${id}, (now() AT TIME ZONE 'Asia/Kolkata')::date, ${source}, 1)
    ON CONFLICT (wallpaper_id, day, source) DO UPDATE SET views = wallpaper_views_daily.views + 1`);
}

const DOWNLOAD_DEDUPE_HOURS = 24;

/**
 * Record a download.
 * - Every download is logged in `downloads` (userId is null for anonymous clients).
 * - The public counter (wallpapers.download_count) and the uploader's profile stat
 *   (users.total_downloads) go up at most once per user + wallpaper per 24h.
 *   Anonymous downloads always count (there is no identity to dedupe on).
 * Unknown wallpaper ids are a no-op (same 200 response as before).
 */
export async function trackDownload(id: string, userId: string | undefined, quality = "original", source: ClientSource = "unknown") {
  const [wallpaper] = await db
    .select({ id: wallpapers.id, uploaderId: wallpapers.uploaderId })
    .from(wallpapers)
    .where(eq(wallpapers.id, id))
    .limit(1);
  if (!wallpaper) return;

  await db.transaction(async (tx) => {
    let counts = true;
    if (userId) {
      const recent = await tx
        .select({ id: downloads.id })
        .from(downloads)
        .where(
          and(
            eq(downloads.userId, userId),
            eq(downloads.wallpaperId, id),
            sql`${downloads.createdAt} > NOW() - make_interval(hours => ${DOWNLOAD_DEDUPE_HOURS})`
          )
        )
        .limit(1);
      counts = recent.length === 0;
    }

    await tx.insert(downloads).values({ userId: userId ?? null, wallpaperId: id, quality, source });

    if (counts) {
      await tx
        .update(wallpapers)
        .set({ downloadCount: sql`${wallpapers.downloadCount} + 1` })
        .where(eq(wallpapers.id, id));
      if (wallpaper.uploaderId) {
        await tx
          .update(users)
          .set({ totalDownloads: sql`${users.totalDownloads} + 1` })
          .where(eq(users.id, wallpaper.uploaderId));
      }
    }
  });
}

// ─── Upload ────────────────────────────────────────────────

export function createUploadUrl(userId: string, fileType: string) {
  return generateUploadUrl("wallpapers", fileType, userId);
}

const UPLOADS_PER_HOUR = 10;

/** Max 10 wallpapers created per user in any rolling hour (counted from the DB, survives restarts). */
export async function assertUploadQuota(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(wallpapers)
    .where(and(eq(wallpapers.uploaderId, userId), sql`${wallpapers.createdAt} > NOW() - INTERVAL '1 hour'`));
  if ((row?.n ?? 0) >= UPLOADS_PER_HOUR) {
    throw new ApiError(429, "Upload limit reached. Try again in an hour.");
  }
}

export async function assertCreator(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(404, "User not found");
  if (!user.isCreator) throw new ApiError(403, "Only creators can upload wallpapers");
}

const MIN_IMAGE_DIMENSION = 200;

export type UploadResult =
  | { kind: "rejected"; reason: string | null }
  | {
      kind: "created";
      wallpaper: typeof wallpapers.$inferSelect;
      moderationStatus: "approved" | "pending";
      /** Set when it went to review for looking like another wallpaper */
      similarTo: DuplicateMatch | null;
    };

/**
 * Upload pipeline (file is already in R2). Normally the upload page ran "prepare" first
 * (services/creatorUpload.service): the size, thumbnail, fingerprint, safety check and AI analysis
 * are then reused from that draft. Without a draft (older app versions) they're done here.
 * The duplicate check always runs again here (another copy may have been published meanwhile):
 * the same picture → 409; a very similar one → published to the review queue instead of live.
 */
export async function createWallpaperFromUpload(userId: string, input: UploadInput): Promise<UploadResult> {
  const key = String(input.key);
  const fileUrl = String(input.fileUrl);
  const title = input.title.trim();
  const description = typeof input.description === "string" ? input.description.trim() || null : null;
  const tags: string[] = input.tags || [];

  if (!key.startsWith(`wallpapers/${userId}/`)) throw new ApiError(400, "Invalid file key");

  const clientW = typeof input.width === "number" ? input.width : Number(input.width) || 0;
  const clientH = typeof input.height === "number" ? input.height : Number(input.height) || 0;

  const draft = await getCreatorDraft(userId, key);
  let metadata, thumb: ThumbVariant | null, print: { phash: string; signature: string } | null;
  let moderation: Awaited<ReturnType<typeof checkImageSafety>>;
  let textEmbedding: number[] | null;
  if (draft) {
    ({ metadata, thumb } = draft);
    print = draft.metadata.print ?? null;
    moderation = draft.moderation;
    textEmbedding = await embedWallpaper(draft.analysis.visualDescription, { title, description, tags }).catch((err) => {
      console.error("[embedding] Text embedding failed during upload:", err);
      return null;
    });
  } else {
    // Read the file once (size, colours, thumbnail, fingerprint), then run the safety check and
    // vision embedding on the 600px thumbnail instead of the full original.
    ({ metadata, thumb, print } = await prepareUploadedImage(key, fileUrl));
    const aiUrl = thumb?.url ?? fileUrl;
    [moderation, textEmbedding] = await Promise.all([
      checkImageSafety(aiUrl),
      generateVisionEmbedding(aiUrl, { title, description, tags }).catch((err) => {
        console.error("[embedding] Vision embedding failed during upload:", err);
        return null;
      }),
    ]);
  }

  const discard = async () => {
    await deleteFile(key).catch(() => {});
    await deleteThumbFor(fileUrl);
    if (draft) await db.delete(uploadDrafts).where(eq(uploadDrafts.key, key));
  };

  if (moderation.status === "rejected") {
    await discard();
    return { kind: "rejected", reason: moderation.reason };
  }

  const format = input.fileType === "image/png" ? "png" : input.fileType === "image/webp" ? "webp" : "jpeg";
  const finalWidth = metadata.width || clientW;
  const finalHeight = metadata.height || clientH;

  if (finalWidth < MIN_IMAGE_DIMENSION || finalHeight < MIN_IMAGE_DIMENSION) {
    await discard();
    throw new ApiError(400, `Image must be at least ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} pixels.`);
  }

  const duplicate: DuplicateMatch | null = print ? await findImageDuplicate(print) : null;
  if (duplicate?.level === "block") {
    await discard();
    throw duplicateError(duplicate, userId);
  }

  const extras = await normalizeExtraCategories(input.extraCategoryIds ?? [], input.categoryId as string);

  // Live unless the safety check wasn't sure or it looks like an edited copy of another wallpaper.
  const status = moderation.status === "pending" || duplicate ? "pending" : "approved";
  const reasons = [
    moderation.status === "pending" ? moderation.reason : null,
    duplicate ? `Possible copy of “${duplicate.title}”${duplicate.uploaderUsername ? ` by @${duplicate.uploaderUsername}` : ""} (very similar image)` : null,
  ].filter(Boolean);

  if (!textEmbedding) console.warn("[embedding] No vector produced — Similar Vibes will be empty until reembedded");

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(wallpapers)
      .values({
        title,
        description,
        fileUrl,
        blurhash: metadata.blurhash,
        dominantColor: metadata.dominantColor,
        palette: metadata.palette,
        width: finalWidth,
        height: finalHeight,
        fileSizeBytes: input.fileSizeBytes || draft?.fileSizeBytes || 0,
        format,
        categoryId: input.categoryId as string,
        uploaderId: userId,
        tags,
        isPremium: false,
        isFeatured: false,
        isAiGenerated: false,
        isMobile: metadata.isMobile,
        downloadCount: 0,
        likeCount: 0,
        viewCount: 0,
        status,
        moderationReason: reasons.length ? reasons.join(" · ") : null,
        ...(print ? { phash: print.phash } : {}),
        ...(textEmbedding ? { textEmbedding } : {}),
        ...(thumb ? { cdnVariants: { thumb } satisfies { thumb: ThumbVariant } } : {}),
      })
      .returning();
    if (extras.length) await setExtraCategories(row!.id, extras, tx);
    await tx
      .update(users)
      .set({ totalUploads: sql`${users.totalUploads} + 1` })
      .where(eq(users.id, userId));
    if (draft) await tx.delete(uploadDrafts).where(eq(uploadDrafts.key, key));
    return row!;
  });

  return { kind: "created", wallpaper: created, moderationStatus: status, similarTo: duplicate };
}

// ─── Admin ─────────────────────────────────────────────────

/** Backfill text_embedding for up to 100 approved wallpapers that lack one. */
export async function reembedMissingText() {
  const rows = await db
    .select({ id: wallpapers.id, title: wallpapers.title, description: wallpapers.description, tags: wallpapers.tags })
    .from(wallpapers)
    .where(sql`text_embedding IS NULL AND status = 'approved'`)
    .limit(100);

  if (rows.length === 0) return { message: "All wallpapers already have text embeddings", updated: 0 };

  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    const textEmbedding = await generateWallpaperTextEmbedding({
      title: row.title,
      description: row.description,
      tags: row.tags,
    });
    if (textEmbedding) {
      await db.update(wallpapers).set({ textEmbedding }).where(eq(wallpapers.id, row.id));
      updated++;
    } else {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 50)); // stay within OpenAI rate limits
  }

  const remaining = await db
    .select({ id: wallpapers.id })
    .from(wallpapers)
    .where(sql`text_embedding IS NULL AND status = 'approved'`)
    .limit(1);

  return { message: `Processed batch of ${rows.length}`, updated, failed, hasMore: remaining.length > 0 };
}
