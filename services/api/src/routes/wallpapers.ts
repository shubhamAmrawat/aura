import { Hono } from "hono";
import { encode } from "blurhash";
import sharp from "sharp";
import { categories, db, users, wallpapers } from "@aura/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { checkImageSafety } from "../lib/vision";
import { generateUploadUrl, deleteFile } from "../lib/r2";
import { authMiddleware } from "../middleware/auth";
import { generateImageEmbedding } from "../lib/embeddings";
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
}> {
  const defaults = {
    dominantColor: "#0a0a0a",
    palette: ["#0a0a0a"],
    blurhash: BLURHASH_FALLBACK,
    width: 0,
    height: 0,
  };
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    const { data: rawPixels, info } = await sharp(buffer)
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
    const { data: bhPixels, info: bhInfo } = await sharp(buffer)
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

    // run content moderation
    console.log(`Running moderation for ${fileUrl}`);
    const moderation = await checkImageSafety(fileUrl);

    if (moderation.status === "rejected") {
      // delete the uploaded file from R2
      await deleteFile(key).catch(() => { });
      return c.json({
        error: moderation.reason || "Image violates content policy",
        moderationStatus: "rejected",
      }, 422);
    }

    const format = fileType === "image/png" ? "png"
      : fileType === "image/webp" ? "webp"
        : "jpeg";

    console.log("Extracting image metadata...");
    const metadata = await extractImageMetadata(fileUrl);
    const finalWidth = metadata.width || clientW;
    const finalHeight = metadata.height || clientH;

    const MIN_IMAGE_DIMENSION = 200;
    if (finalWidth < MIN_IMAGE_DIMENSION || finalHeight < MIN_IMAGE_DIMENSION) {
      await deleteFile(key).catch(() => { });
      return c.json({
        error: `Image must be at least ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} pixels.`,
      }, 400);
    }

    // create wallpaper record
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
        downloadCount: 0,
        likeCount: 0,
        viewCount: 0,
        status: moderation.status,
      })
      .returning();

    const created = newWallpaper[0];

    // increment user upload count
    await db
      .update(users)
      .set({ totalUploads: sql`${users.totalUploads} + 1` })
      .where(eq(users.id, userId));

    // wait for embedding so detail page / similar search work immediately after redirect
    if (created) {
      try {
        const embedding = await generateImageEmbedding(fileUrl);
        if (embedding) {
          await db
            .update(wallpapers)
            .set({ embedding })
            .where(eq(wallpapers.id, created.id));
          console.log(`[embedding] Saved for wallpaper ${created.id}`);
        } else {
          console.warn(`[embedding] No vector produced for wallpaper ${created.id}`);
        }
      } catch (err) {
        console.error("[embedding] Failed:", err);
      }
    }
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

    // get the source wallpaper's embedding
    const source = await db
      .select({
        id: wallpapers.id,
        embedding: wallpapers.embedding,
      })
      .from(wallpapers)
      .where(eq(wallpapers.id, id))
      .limit(1);

    if (!source[0]) {
      return c.json({ error: "Wallpaper not found" }, 404);
    }

    if (!source[0].embedding) {
      return c.json({ data: [], hasMore: false });
    }

    const embeddingStr = `[${source[0].embedding.join(",")}]`;

    // <=> is pgvector cosine distance; fetch one extra row to compute hasMore
    const raw = await db.execute(sql`
      SELECT 
        id, title, file_url, blurhash, dominant_color,
        width, height, like_count, download_count,
        1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM wallpapers
      WHERE 
        status = 'approved'
        AND id != ${id}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${fetchCount}
      OFFSET ${offset}
    `);

    const rows = [...raw];
    const hasMore = rows.length > pageLimit;
    const data = hasMore ? rows.slice(0, pageLimit) : rows;

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

    if (result.length === 0) {
      return c.json({ error: "Wallpaper not found" }, 404);
    }

    return c.json({ data: result[0] });
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
