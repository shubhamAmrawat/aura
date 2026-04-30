import { Hono } from "hono";
import { db, wallpapers } from "@aura/db";
import { and, ilike, or, desc, eq, sql } from "drizzle-orm";
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

type ScreenFilter = "mobile" | "tablet";

function getScreenFilter(screen: string | undefined): ScreenFilter | null {
  if (!screen) return null;
  if (screen === "mobile" || screen === "tablet") return screen;
  return null;
}

searchRoutes.get("/", async (c) => {
  try {
    const q = c.req.query("q")?.trim();
    const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
    const offset = Number(c.req.query("offset")) || 0;
    const mode = c.req.query("mode") || "hybrid";
    const screenQuery = c.req.query("screen")?.trim().toLowerCase();
    const screenFilter = getScreenFilter(screenQuery);
    if (screenQuery && !screenFilter) {
      return c.json(
        { error: "Invalid screen value. Use 'mobile' or 'tablet'." },
        400
      );
    }
    const screenFilterSql =
      screenFilter === "mobile"
        ? sql`AND is_mobile = true`
        : screenFilter === "tablet"
          ? sql`AND is_mobile = false`
          : sql``;

    if (!q || q.length < 2) {
      return c.json({ data: [], hasMore: false, mode: "none" });
    }

    const pattern = `%${q}%`;

    // ── Semantic / Hybrid ────────────────────────────────────────────────────
    // Uses `text_embedding` column (OpenAI text-embedding-3-small of wallpaper
    // metadata). The query is embedded with the same OpenAI model → same vector
    // space → valid cosine similarity.
    if (mode === "semantic" || mode === "hybrid") {
      console.log(`[search] mode=${mode} q="${q}" — generating OpenAI text embedding`);
      const queryEmbedding = await generateTextEmbedding(q);

      if (queryEmbedding) {
        console.log(`[search] embedding generated (${queryEmbedding.length}-dim) — running vector query`);
        const embStr = `[${queryEmbedding.join(",")}]`;

        const semanticSql = sql`
          SELECT
            id, title, file_url, blurhash, dominant_color,
            palette, width, height, like_count, download_count,
            view_count, trending_score, is_featured, is_premium,
            tags, category_id, status, created_at, format, file_size_bytes,
            (1 - (text_embedding <=> ${embStr}::vector)) AS semantic_score,
            CASE
              WHEN LOWER(title) LIKE LOWER(${pattern}) THEN 0.15
              WHEN array_to_string(tags, ' ') ILIKE ${pattern} THEN 0.10
              WHEN LOWER(COALESCE(description, '')) LIKE LOWER(${pattern}) THEN 0.05
              ELSE 0
            END AS keyword_boost,
            (
              (1 - (text_embedding <=> ${embStr}::vector)) * 0.85 +
              CASE
                WHEN LOWER(title) LIKE LOWER(${pattern}) THEN 0.15
                WHEN array_to_string(tags, ' ') ILIKE ${pattern} THEN 0.10
                WHEN LOWER(COALESCE(description, '')) LIKE LOWER(${pattern}) THEN 0.05
                ELSE 0
              END
            ) AS hybrid_score
          FROM wallpapers
          WHERE status = 'approved'
            AND text_embedding IS NOT NULL
            ${screenFilterSql}
          ORDER BY hybrid_score DESC
          LIMIT ${limit + 1}
          OFFSET ${offset}
        `;

        const results = await db.execute(semanticSql);
        const rows = [...results];
        const hasMore = rows.length > limit;

        console.log(`[search] semantic OK — ${Math.min(rows.length, limit)} results (hasMore=${hasMore})`);
        return c.json({
          data: hasMore ? rows.slice(0, limit) : rows,
          hasMore,
          mode: mode === "semantic" ? "semantic" : "hybrid",
        });
      } else {
        console.warn(`[search] OpenAI embedding returned null — falling back to keyword search`);
      }
    }

    // ── Keyword fallback ─────────────────────────────────────────────────────
    console.log(`[search] mode=keyword q="${q}"`);
    const results = await db
      .select(searchSelect)
      .from(wallpapers)
      .where(
        and(
          eq(wallpapers.status, "approved"),
          screenFilter === "mobile"
            ? eq(wallpapers.isMobile, true)
            : screenFilter === "tablet"
              ? eq(wallpapers.isMobile, false)
              : undefined,
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
