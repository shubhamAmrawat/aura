import { Hono } from "hono";
import { encode } from "blurhash";
import sharp from "sharp";
import { categories, db, users, wallpapers } from "@aura/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { checkImageSafety } from "../lib/vision";
import { generateUploadUrl, deleteFile } from "../lib/r2";
import { authMiddleware } from "../middleware/auth";
import { generateVisionEmbedding } from "../lib/embeddings";
const BLURHASH_FALLBACK = "LKO2:N%2Tw=w]~RBVZRi};RPxuwH";
// define reusable column selection for list views
const wallpaperListSelect = {
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

async function extractImageMetadata(fileUrl: string): Promise<{
  dominantColor: string;
  palette: string[];
  blurhash: string;
  width: number;
  height: number;
  isMobile: boolean;
}> {
  const defaults = {
    dominantColor: "#0a0a0a",
    palette: ["#0a0a0a"],
    blurhash: BLURHASH_FALLBACK,
    width: 0,
    height: 0,
    isMobile: false,
  };
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // .rotate() with no args applies EXIF auto-rotation so stored width/height
    // always match what the browser displays (prevents portrait↔landscape mismatch)
    const rotatedBuffer = await sharp(buffer).rotate().toBuffer();
    const meta = await sharp(rotatedBuffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    const { data: rawPixels, info } = await sharp(rotatedBuffer)
      .resize(200, 200, { fit: "inside" })
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    const pixelCount = w * h;
    if (pixelCount === 0 || ch < 3) throw new Error("Invalid pixel buffer");

    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < rawPixels.length; i += ch) {
      r += rawPixels[i]!;
      g += rawPixels[i + 1]!;
      b += rawPixels[i + 2]!;
    }
    r = Math.round(r / pixelCount);
    g = Math.round(g / pixelCount);
    b = Math.round(b / pixelCount);
    const dominantColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

    const palette: string[] = [dominantColor];
    const corners: [number, number][] = [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ];
    for (const [px, py] of corners) {
      if (palette.length >= 5) break;
      const sx = Math.max(0, Math.min(px, w - 1));
      const sy = Math.max(0, Math.min(py, h - 1));
      const idx = (sy * w + sx) * ch;
      const pr = rawPixels[idx]!;
      const pg = rawPixels[idx + 1]!;
      const pb = rawPixels[idx + 2]!;
      const hex = `#${pr.toString(16).padStart(2, "0")}${pg.toString(16).padStart(2, "0")}${pb.toString(16).padStart(2, "0")}`;
      if (!palette.includes(hex)) palette.push(hex);
    }

    const bhW = 32;
    const bhH = Math.max(1, Math.round((32 * Math.max(1, height)) / Math.max(1, width)));
    const { data: bhPixels, info: bhInfo } = await sharp(rotatedBuffer)
      .resize(bhW, bhH, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const blurhashValue = encode(
      new Uint8ClampedArray(bhPixels),
      bhInfo.width,
      bhInfo.height,
      4,
      3
    );

    return {
      dominantColor,
      palette,
      blurhash: blurhashValue,
      width,
      height,
      // Portrait/square (ratio ≥ 0.9) → mobile; clearly landscape (ratio < 0.9) → desktop
      isMobile: width > 0 ? height / width >= 0.9 : false,
    };
  } catch (error) {
    console.error("Metadata extraction failed:", error);
    return defaults;
  }
}

type Variables = {
  userId: string;
};

export const wallpaperRoutes = new Hono<{ Variables: Variables }>();

// GET /api/wallpapers?featured=true&limit=20&category=nature&q=forest
wallpaperRoutes.get("/", async (c) => {
  try {
    const featured = c.req.query("featured");
    const limitParam = c.req.query("limit");

    let limit: number;
    if (limitParam === undefined || limitParam === "") {
      limit = 150;
    } else {
      const n = Number(limitParam);
      limit = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 100) : 30;
    }

    const categorySlug = c.req.query("category")?.trim();
    const q = c.req.query("q")?.trim();

    const offset = Number(c.req.query("offset")) || 0;

    const conditions = [eq(wallpapers.status, "approved")];
    if (featured === "true") {
      conditions.push(eq(wallpapers.isFeatured, true));
    }

    if (categorySlug) {
      const [catRow] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      if (catRow) {
        conditions.push(eq(wallpapers.categoryId, catRow.id));
      } else {
        conditions.push(sql`1 = 0`);
      }
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(wallpapers.title, pattern),
          ilike(wallpapers.description, pattern),
          sql`array_to_string(${wallpapers.tags}, ' ') ILIKE ${pattern}`
        )!
      );
    }

    const result = await db
      .select(wallpaperListSelect)
      .from(wallpapers)
      .where(and(...conditions))
      .orderBy(desc(wallpapers.createdAt))
      .limit(limit)
      .offset(offset);

    const hasMore = result.length === limit;

    c.header("Cache-Control", "no-store");
    return c.json({
      data: result,
      count: result.length,
      hasMore,
    });
  } catch (error) {
    console.error("Wallpapers error:", error);
    return c.json({ error: "Failed to fetch wallpapers" }, 500);
  }
});

// POST /api/wallpapers/upload-url — get R2 presigned URL
wallpaperRoutes.post("/upload-url", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const { fileType } = await c.req.json();

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(fileType)) {
      return c.json({ error: "Only JPEG, PNG and WebP are allowed" }, 400);
    }

    const { uploadUrl, fileUrl, key } = await generateUploadUrl(
      "wallpapers",
      fileType,
      userId
    );

    return c.json({ uploadUrl, fileUrl, key });
  } catch (error) {
    console.error("Upload URL error:", error);
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
});

// POST /api/wallpapers/upload — create wallpaper after R2 upload
wallpaperRoutes.post("/upload", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");

    // check if user is a creator
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userRecord[0];
    if (!user) return c.json({ error: "User not found" }, 404);
    if (!user.isCreator) {
      return c.json({ error: "Only creators can upload wallpapers" }, 403);
    }

    const {
      title,
      description,
      categoryId,
      tags,
      fileUrl,
      key,
      width: clientWidth,
      height: clientHeight,
      fileSizeBytes,
      fileType,
    } = await c.req.json();

    const clientW = typeof clientWidth === "number" ? clientWidth : Number(clientWidth) || 0;
    const clientH = typeof clientHeight === "number" ? clientHeight : Number(clientHeight) || 0;

    // validate required fields
    if (!title?.trim()) return c.json({ error: "Title is required" }, 400);
    if (!fileUrl || !key) return c.json({ error: "File is required" }, 400);
    if (!categoryId) return c.json({ error: "Category is required" }, 400);

    // validate key belongs to this user
    if (!key.startsWith(`wallpapers/${userId}/`)) {
      return c.json({ error: "Invalid file key" }, 400);
    }

  
    // Run moderation, metadata extraction, and vision embedding all in parallel.
    // Sightengine + GPT-4o-mini both take ~1-2s — overlapping them costs nothing extra.
    // When all three resolve, the embedding is ready to be stored immediately in the
    // INSERT, so Similar Vibes works the moment the user lands on the wallpaper page.
    const [moderation, metadata, textEmbedding] = await Promise.all([
      checkImageSafety(fileUrl),
      extractImageMetadata(fileUrl),
      generateVisionEmbedding(fileUrl, {
        title: title.trim(),
        description: description?.trim() || null,
        tags: tags || [],
      }).catch((err) => {
        console.error("[embedding] Vision embedding failed during upload:", err);
        return null;
      }),
    ]);

    if (moderation.status === "rejected") {
      await deleteFile(key).catch(() => { });
      return c.json({
        error: moderation.reason || "Image violates content policy",
        moderationStatus: "rejected",
      }, 422);
    }

    const format = fileType === "image/png" ? "png"
      : fileType === "image/webp" ? "webp"
        : "jpeg";

    const finalWidth = metadata.width || clientW;
    const finalHeight = metadata.height || clientH;

    const MIN_IMAGE_DIMENSION = 200;
    if (finalWidth < MIN_IMAGE_DIMENSION || finalHeight < MIN_IMAGE_DIMENSION) {
      await deleteFile(key).catch(() => { });
      return c.json({
        error: `Image must be at least ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} pixels.`,
      }, 400);
    }

    if (textEmbedding) {
      console.log(`[embedding] Vision+text vector ready (${textEmbedding.length}-dim)`);
    } else {
      console.warn("[embedding] No vector produced — Similar Vibes will be empty until reembedded");
    }

    // create wallpaper record with embedding already set — Similar Vibes works immediately
    const newWallpaper = await db
      .insert(wallpapers)
      .values({
        title: title.trim(),
        description: description?.trim() || null,
        fileUrl,
        blurhash: metadata.blurhash,
        dominantColor: metadata.dominantColor,
        palette: metadata.palette,
        width: finalWidth,
        height: finalHeight,
        fileSizeBytes: fileSizeBytes || 0,
        format: format as "jpeg" | "png" | "webp" | "avif",
        categoryId,
        uploaderId: userId,
        tags: tags || [],
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

    const created = newWallpaper[0];

    // increment user upload count
    await db
      .update(users)
      .set({ totalUploads: sql`${users.totalUploads} + 1` })
      .where(eq(users.id, userId));

    return c.json({
      wallpaper: created,
      moderationStatus: moderation.status,
      message: moderation.status === "approved"
        ? "Wallpaper uploaded and live!"
        : "Wallpaper uploaded and under review",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Failed to upload wallpaper" }, 500);
  }
});
wallpaperRoutes.get("/trending", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
    const offset = Number(c.req.query("offset")) || 0;

    const result = await db
      .select(wallpaperListSelect)
      .from(wallpapers)
      .where(eq(wallpapers.status, "approved"))
      .orderBy(desc(wallpapers.trendingScore))
      .limit(limit)
      .offset(offset);

    const hasMore = result.length === limit;

    c.header("Cache-Control", "no-store");
    return c.json({
      data: result,
      count: result.length,
      hasMore,
    });
  } catch (error) {
    console.error("Trending error:", error);
    return c.json({ error: "Failed to fetch trending wallpapers" }, 500);
  }
});

// POST /api/wallpapers/trending/recalculate — manual trigger
wallpaperRoutes.post("/trending/recalculate", async (c) => {
  try {
    // simple secret check — not full auth, just protection
    const secret = c.req.header("X-Admin-Secret");
    if (secret !== process.env.ADMIN_SECRET) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { recalculateTrendingScores } = await import("../lib/trending");
    const result = await recalculateTrendingScores();

    return c.json({
      message: "Trending scores recalculated",
      ...result,
    });
  } catch (error) {
    console.error("Recalculate error:", error);
    return c.json({ error: "Failed to recalculate" }, 500);
  }
});

// GET /api/wallpapers/:id/similar — visual similarity search (paginated like /trending)
wallpaperRoutes.get("/:id/similar", async (c) => {
  try {
    const id = c.req.param("id");
    const pageLimit = Math.min(Number(c.req.query("limit")) || 24, 50);
    const offset = Math.max(0, Math.floor(Number(c.req.query("offset")) || 0));
    const fetchCount = pageLimit + 1;

    const source = await db
      .select()
      .from(wallpapers)
      .where(eq(wallpapers.id, id))
      .limit(1);

    if (!source[0]) return c.json({ error: "Wallpaper not found" }, 404);

    const src = source[0];

    if (!src.textEmbedding) {
      return c.json({ data: [], hasMore: false });
    }

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

    // hybrid scoring: vision+semantic similarity + category bonus + tag overlap
    const similar = await db.execute(sql`
      SELECT 
        id, title, file_url, blurhash, dominant_color,
        width, height, like_count, download_count,
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
      ORDER BY hybrid_score DESC
      LIMIT ${fetchCount}
      OFFSET ${offset}
    `);

    const rows = [...similar];
    const hasMore = rows.length > pageLimit;
    const data = hasMore ? rows.slice(0, pageLimit) : rows;

    c.header("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
    return c.json({ data, hasMore });
  } catch (error) {
    console.error("Similar wallpapers error:", error);
    return c.json({ error: "Failed to fetch similar wallpapers" }, 500);
  }
});
// GET /api/wallpapers/:id — get single wallpaper
wallpaperRoutes.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const result = await db
      .select()
      .from(wallpapers)
      .where(eq(wallpapers.id, id))
      .limit(1);

    const wallpaperRecord = result[0];

    if (!wallpaperRecord) {
      return c.json({ error: "Wallpaper not found" }, 404);
    }

    const { textEmbedding: _textEmbedding, ...wallpaper } = wallpaperRecord;

    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return c.json({ data: wallpaper });
  } catch (error) {
    console.error("Wallpapers error:", error);
    return c.json({ error: "Failed to fetch wallpapers" }, 500);
  }
});


// POST /api/wallpapers/:id/download — track download
wallpaperRoutes.post("/:id/download", async (c) => {
  try {
    const id = c.req.param("id");
    await db
      .update(wallpapers)
      .set({ downloadCount: sql`${wallpapers.downloadCount} + 1` })
      .where(eq(wallpapers.id, id));
    return c.json({ message: "Download tracked" });
  } catch (error) {
    console.error("Download track error:", error);
    return c.json({ error: "Failed to track download" }, 500);
  }
});

// POST /api/wallpapers/reembed-text — backfill text_embedding for existing wallpapers
// Requires X-Admin-Secret header. Processes in small batches to avoid rate limits.
wallpaperRoutes.post("/reembed-text", async (c) => {
  if (c.req.header("X-Admin-Secret") !== process.env.ADMIN_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Fetch wallpapers that are missing text_embedding
    const rows = await db
      .select({
        id: wallpapers.id,
        title: wallpapers.title,
        description: wallpapers.description,
        tags: wallpapers.tags,
      })
      .from(wallpapers)
      .where(sql`text_embedding IS NULL AND status = 'approved'`)
      .limit(100);

    if (rows.length === 0) {
      return c.json({ message: "All wallpapers already have text embeddings", updated: 0 });
    }

    let updated = 0;
    let failed = 0;

    const { generateWallpaperTextEmbedding } = await import("../lib/embeddings");

    for (const row of rows) {
      const textEmbedding = await generateWallpaperTextEmbedding({
        title: row.title,
        description: row.description,
        tags: row.tags,
      });

      if (textEmbedding) {
        await db
          .update(wallpapers)
          .set({ textEmbedding })
          .where(eq(wallpapers.id, row.id));
        updated++;
      } else {
        failed++;
      }

      // Small delay to stay within OpenAI rate limits
      await new Promise((r) => setTimeout(r, 50));
    }

    const remaining = await db
      .select({ id: wallpapers.id })
      .from(wallpapers)
      .where(sql`text_embedding IS NULL AND status = 'approved'`)
      .limit(1);

    return c.json({
      message: `Processed batch of ${rows.length}`,
      updated,
      failed,
      hasMore: remaining.length > 0,
    });
  } catch (error) {
    console.error("Reembed error:", error);
    return c.json({ error: "Reembed failed" }, 500);
  }
});
