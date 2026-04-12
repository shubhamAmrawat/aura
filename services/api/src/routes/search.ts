import { Hono } from "hono";
import { db, wallpapers } from "@aura/db";
import { eq, sql, and, ilike, or, desc } from "drizzle-orm";
import { generateTextEmbedding } from "../lib/embeddings";

export const searchRoutes = new Hono();

const searchSelect = {
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

searchRoutes.get("/", async (c) => {
  try {
    const q = c.req.query("q")?.trim();
    const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
    const offset = Number(c.req.query("offset")) || 0;
    const mode = c.req.query("mode") || "hybrid";

    if (!q || q.length < 2) {
      return c.json({ data: [], hasMore: false, mode: "none" });
    }

    const pattern = `%${q}%`;

    // ── Semantic / Hybrid ───────────────────────────────────
    if (mode === "semantic" || mode === "hybrid") {
      const textEmbedding = await generateTextEmbedding(q);

      if (textEmbedding) {
        const embeddingStr = `[${textEmbedding.join(",")}]`;

        if (mode === "semantic") {
          const results = await db.execute(sql`
            SELECT
              id, title, file_url, blurhash, dominant_color,
              palette, width, height, like_count, download_count,
              view_count, trending_score, is_featured, is_premium,
              tags, category_id, status, created_at, format, file_size_bytes,
              (1 - (embedding <=> ${embeddingStr}::vector)) AS semantic_score,
              CASE
                WHEN LOWER(title) LIKE LOWER(${pattern}) THEN 0.15
                WHEN array_to_string(tags, ' ') ILIKE ${pattern} THEN 0.10
                WHEN LOWER(COALESCE(description, '')) LIKE LOWER(${pattern}) THEN 0.05
                ELSE 0
              END AS keyword_boost,
              (
                (1 - (embedding <=> ${embeddingStr}::vector)) * 0.85 +
                CASE
                  WHEN LOWER(title) LIKE LOWER(${pattern}) THEN 0.15
                  WHEN array_to_string(tags, ' ') ILIKE ${pattern} THEN 0.10
                  WHEN LOWER(COALESCE(description, '')) LIKE LOWER(${pattern}) THEN 0.05
                  ELSE 0
                END
              ) AS hybrid_score
            FROM wallpapers
            WHERE status = 'approved'
              AND embedding IS NOT NULL
            ORDER BY hybrid_score DESC
            LIMIT ${limit + 1}
            OFFSET ${offset}
          `);

          const rows = [...results];
          const hasMore = rows.length > limit;
          return c.json({
            data: hasMore ? rows.slice(0, limit) : rows,
            hasMore,
            mode: "semantic",
          });
        }

        // hybrid
        const results = await db.execute(sql`
          SELECT
            id, title, file_url, blurhash, dominant_color,
            palette, width, height, like_count, download_count,
            view_count, trending_score, is_featured, is_premium,
            tags, category_id, status, created_at, format, file_size_bytes,
            (1 - (embedding <=> ${embeddingStr}::vector)) AS semantic_score,
            CASE
              WHEN LOWER(title) LIKE LOWER(${pattern}) THEN 0.15
              WHEN array_to_string(tags, ' ') ILIKE ${pattern} THEN 0.10
              WHEN LOWER(COALESCE(description, '')) LIKE LOWER(${pattern}) THEN 0.05
              ELSE 0
            END AS keyword_boost,
            (
              (1 - (embedding <=> ${embeddingStr}::vector)) * 0.85 +
              CASE
                WHEN LOWER(title) LIKE LOWER(${pattern}) THEN 0.15
                WHEN array_to_string(tags, ' ') ILIKE ${pattern} THEN 0.10
                WHEN LOWER(COALESCE(description, '')) LIKE LOWER(${pattern}) THEN 0.05
                ELSE 0
              END
            ) AS hybrid_score
          FROM wallpapers
          WHERE status = 'approved'
            AND embedding IS NOT NULL
          ORDER BY hybrid_score DESC
          LIMIT ${limit + 1}
          OFFSET ${offset}
        `);

        const rows = [...results];
        const hasMore = rows.length > limit;
        return c.json({
          data: hasMore ? rows.slice(0, limit) : rows,
          hasMore,
          mode: "hybrid",
        });
      }
    }

    // ── Keyword fallback ────────────────────────────────────
    const results = await db
      .select(searchSelect)
      .from(wallpapers)
      .where(
        and(
          eq(wallpapers.status, "approved"),
          or(
            ilike(wallpapers.title, pattern),
            ilike(wallpapers.description, pattern),
            sql`array_to_string(${wallpapers.tags}, ' ') ILIKE ${pattern}`
          )!
        )
      )
      .orderBy(desc(wallpapers.trendingScore))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = results.length > limit;
    return c.json({
      data: hasMore ? results.slice(0, limit) : results,
      hasMore,
      mode: "keyword",
    });
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});