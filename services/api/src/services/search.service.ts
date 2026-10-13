import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../config/db";
import { wallpapers } from "../models";
import { screenFilterSql, type ScreenFilter } from "../utils/screenFilter";
import { generateTextEmbedding } from "../integrations/openai";

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

type SuggestionSource = "editorial" | "trending-title" | "trending-tag";

const EDITORIAL_SEARCH_SUGGESTIONS = [
  "neon city",
  "amoled minimal",
  "dark abstract",
  "cozy rainy evening",
  "peaceful mountain morning",
  "futuristic cyberpunk",
  "space art",
  "anime aesthetic",
];

function normalizeSuggestion(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Editorial seeds first, then trending titles, then tags of trending wallpapers. */
export async function getSuggestions(params: { screen: ScreenFilter | null; limit: number }) {
  const target = Math.max(1, Math.min(params.limit, 20));
  const seen = new Set<string>();
  const output: { term: string; source: SuggestionSource }[] = [];

  const push = (term: string, source: SuggestionSource) => {
    const normalized = normalizeSuggestion(term);
    if (!normalized || normalized.length < 3 || seen.has(normalized)) return;
    seen.add(normalized);
    output.push({ term: normalized, source });
  };

  for (const term of EDITORIAL_SEARCH_SUGGESTIONS) {
    if (output.length >= target) break;
    push(term, "editorial");
  }

  const screenSql = screenFilterSql(params.screen);

  const trendingTitles = await db.execute(sql`
    SELECT title
    FROM wallpapers
    WHERE status = 'approved'
      ${screenSql}
      AND COALESCE(title, '') <> ''
    ORDER BY trending_score DESC NULLS LAST, view_count DESC NULLS LAST
    LIMIT 40
  `);
  for (const row of trendingTitles as Array<{ title?: string | null }>) {
    if (output.length >= target) break;
    if (!row.title) continue;
    push(row.title, "trending-title");
  }

  const trendingTags = await db.execute(sql`
    SELECT DISTINCT tag
    FROM (
      SELECT UNNEST(tags) AS tag
      FROM wallpapers
      WHERE status = 'approved'
        ${screenSql}
      ORDER BY trending_score DESC NULLS LAST, view_count DESC NULLS LAST
      LIMIT 200
    ) t
    WHERE COALESCE(tag, '') <> ''
    LIMIT 60
  `);
  for (const row of trendingTags as Array<{ tag?: string | null }>) {
    if (output.length >= target) break;
    if (!row.tag) continue;
    push(row.tag, "trending-tag");
  }

  return output.slice(0, target);
}

/** Prefix matches from titles and tags (lowercased, unique). */
/** Escape LIKE wildcards so user input matches literally. */
function likeEscape(s: string) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Type-ahead terms: tags and short titles whose text, or any word in it, starts with `q`.
 * Ranked: starts-with first, then tags before titles, then by how many wallpapers use it
 * (titles: by downloads), then shorter terms. Long or comma-list terms are skipped.
 */
export async function getAutocomplete(params: { q: string; limit: number; screen: ScreenFilter | null }) {
  const screenSql = screenFilterSql(params.screen);
  const q = likeEscape(params.q.toLowerCase());
  const starts = `${q}%`;
  const wordStarts = `% ${q}%`;

  const rows = await db.execute(sql`
    SELECT term FROM (
      SELECT LOWER(TRIM(tag)) AS term, count(*)::int AS score, 0 AS kind
      FROM wallpapers, UNNEST(tags) AS tag
      WHERE status = 'approved' ${screenSql}
      GROUP BY 1
      UNION ALL
      SELECT LOWER(TRIM(title)) AS term, (sum(download_count) + count(*))::int AS score, 1 AS kind
      FROM wallpapers
      WHERE status = 'approved' ${screenSql}
      GROUP BY 1
    ) t
    WHERE (term LIKE ${starts} ESCAPE '\\' OR term LIKE ${wordStarts} ESCAPE '\\')
      AND length(term) BETWEEN 2 AND 40
      AND position(',' IN term) = 0
    ORDER BY (term LIKE ${starts} ESCAPE '\\') DESC, kind ASC, score DESC, length(term) ASC, term ASC
    LIMIT ${params.limit * 2}
  `);

  const seen = new Set<string>();
  const data: string[] = [];
  for (const row of rows as Array<{ term?: string | null }>) {
    const term = row.term?.trim();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    data.push(term);
    if (data.length >= params.limit) break;
  }
  return data;
}

export type SearchMode = "semantic" | "hybrid" | "keyword";

/**
 * Semantic/hybrid: 0.85 × cosine similarity (OpenAI text-embedding-3-small, same vector
 * space as stored text_embedding) + keyword boost. Falls back to keyword search if the
 * query embedding can't be generated.
 */
export async function search(params: {
  q: string;
  limit: number;
  offset: number;
  mode: string;
  screen: ScreenFilter | null;
}) {
  const { q, limit, offset, mode, screen } = params;
  const pattern = `%${q}%`;

  if (mode === "semantic" || mode === "hybrid") {
    console.log(`[search] mode=${mode} q="${q}" — generating OpenAI text embedding`);
    const queryEmbedding = await generateTextEmbedding(q);

    if (queryEmbedding) {
      const embStr = `[${queryEmbedding.join(",")}]`;
      const results = await db.execute(sql`
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
          ${screenFilterSql(screen)}
        ORDER BY hybrid_score DESC
        LIMIT ${limit + 1}
        OFFSET ${offset}
      `);

      const rows = [...results];
      const hasMore = rows.length > limit;
      console.log(`[search] semantic OK — ${Math.min(rows.length, limit)} results (hasMore=${hasMore})`);
      return {
        data: hasMore ? rows.slice(0, limit) : rows,
        hasMore,
        mode: mode === "semantic" ? "semantic" : "hybrid",
      };
    }
    console.warn("[search] OpenAI embedding returned null — falling back to keyword search");
  }

  console.log(`[search] mode=keyword q="${q}"`);
  const results = await db
    .select(searchSelect)
    .from(wallpapers)
    .where(
      and(
        eq(wallpapers.status, "approved"),
        screen === "mobile"
          ? eq(wallpapers.isMobile, true)
          : screen === "tablet"
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
  return { data: hasMore ? results.slice(0, limit) : results, hasMore, mode: "keyword" };
}
