import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../config/db";
import { categories, downloads, users, wallpapers } from "../models";
import { ApiError } from "../utils/ApiError";
import { screenFilterSql, type ScreenFilter } from "../utils/screenFilter";
import { extractImageMetadata } from "../utils/imageMetadata";
import { checkImageSafety } from "../integrations/sightengine";
import { deleteFile, generateUploadUrl } from "../integrations/r2";
import { generateVisionEmbedding, generateWallpaperTextEmbedding } from "../integrations/openai";
import type { UploadInput } from "../validators/wallpaper.schema";

/** Columns returned by every list/feed endpoint. */
export const wallpaperListSelect = {
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
  const conditions = [eq(wallpapers.status, "approved")];
  if (params.featured) conditions.push(eq(wallpapers.isFeatured, true));

  if (params.categorySlug) {
    const [catRow] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, params.categorySlug))
      .limit(1);
    conditions.push(catRow ? eq(wallpapers.categoryId, catRow.id) : sql`1 = 0`);
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
  const conditions = [eq(wallpapers.status, "approved")];
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

/** Single wallpaper (any status), without the large textEmbedding vector. */
export async function getWallpaper(id: string) {
  const [record] = await db.select().from(wallpapers).where(eq(wallpapers.id, id)).limit(1);
  if (!record) throw new ApiError(404, "Wallpaper not found");
  const { textEmbedding: _textEmbedding, ...wallpaper } = record;
  return wallpaper;
}

/**
 * Hybrid similarity: 0.75 × cosine + 0.15 same-category bonus + 0.10 × tag Jaccard.
 * Fetches limit+1 rows to compute hasMore. Returns null when the source has no embedding.
 */
export async function getSimilar(id: string, params: { limit: number; offset: number; screen: ScreenFilter | null }) {
  const [src] = await db.select().from(wallpapers).where(eq(wallpapers.id, id)).limit(1);
  if (!src) throw new ApiError(404, "Wallpaper not found");
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
      id, title, description, file_url, blurhash, dominant_color,
      palette, width, height, like_count, download_count, view_count,
      format, file_size_bytes,
      category_id, tags,
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
    ORDER BY hybrid_score DESC
    LIMIT ${params.limit + 1}
    OFFSET ${params.offset}
  `);

  const rows = [...similar];
  const hasMore = rows.length > params.limit;
  return { data: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}

/** Count a view (approved wallpapers only). */
export async function trackView(id: string) {
  await db
    .update(wallpapers)
    .set({ viewCount: sql`${wallpapers.viewCount} + 1` })
    .where(and(eq(wallpapers.id, id), eq(wallpapers.status, "approved")));
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
export async function trackDownload(id: string, userId: string | undefined, quality = "original") {
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

    await tx.insert(downloads).values({ userId: userId ?? null, wallpaperId: id, quality });

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
  | { kind: "created"; wallpaper: typeof wallpapers.$inferSelect; moderationStatus: "approved" | "pending" };

/**
 * Upload pipeline (file is already in R2):
 * moderation + metadata extraction + vision embedding run in parallel, then the row
 * is inserted with the embedding so "Similar Vibes" works immediately.
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

  const [moderation, metadata, textEmbedding] = await Promise.all([
    checkImageSafety(fileUrl),
    extractImageMetadata(fileUrl),
    generateVisionEmbedding(fileUrl, { title, description, tags }).catch((err) => {
      console.error("[embedding] Vision embedding failed during upload:", err);
      return null;
    }),
  ]);

  if (moderation.status === "rejected") {
    await deleteFile(key).catch(() => {});
    return { kind: "rejected", reason: moderation.reason };
  }

  const format = input.fileType === "image/png" ? "png" : input.fileType === "image/webp" ? "webp" : "jpeg";
  const finalWidth = metadata.width || clientW;
  const finalHeight = metadata.height || clientH;

  if (finalWidth < MIN_IMAGE_DIMENSION || finalHeight < MIN_IMAGE_DIMENSION) {
    await deleteFile(key).catch(() => {});
    throw new ApiError(400, `Image must be at least ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} pixels.`);
  }

  if (textEmbedding) {
    console.log(`[embedding] Vision+text vector ready (${textEmbedding.length}-dim)`);
  } else {
    console.warn("[embedding] No vector produced — Similar Vibes will be empty until reembedded");
  }

  const [created] = await db
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
      fileSizeBytes: input.fileSizeBytes || 0,
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
      status: moderation.status,
      ...(textEmbedding ? { textEmbedding } : {}),
    })
    .returning();

  await db
    .update(users)
    .set({ totalUploads: sql`${users.totalUploads} + 1` })
    .where(eq(users.id, userId));

  return { kind: "created", wallpaper: created!, moderationStatus: moderation.status };
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
