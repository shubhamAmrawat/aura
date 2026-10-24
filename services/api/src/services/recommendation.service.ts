import { sql } from "drizzle-orm";
import { db } from "../config/db";
import { screenFilterSql, visibleCategoryFilterSql, type ScreenFilter } from "../utils/screenFilter";
import { creatorIdColumnSql } from "../utils/creatorId";
import { phashDistance } from "../utils/phash";

export interface PersonalizedFeedParams {
  userId?: string | null;
  guestIds?: string[];
  screen: ScreenFilter | null;
  limit: number;
  offset: number;
}

export interface RecommendationProfile {
  hasProfile: boolean;
  interactionCount: number;
  topCategories: string[];
  topTags: string[];
  primaryColors: string[];
}

interface UserSignalRow {
  id: string;
  text_embedding: unknown;
  category_id: string | null;
  tags: string[] | null;
  dominant_color: string | null;
  created_at: Date | string;
  base_weight: number | string;
}

function parseVector(val: unknown): number[] | null {
  if (Array.isArray(val)) return val.map(Number);
  if (typeof val === "string") {
    const clean = val.replace(/^\[/, "").replace(/\]$/, "").trim();
    if (!clean) return null;
    return clean.split(",").map((s) => Number(s.trim()));
  }
  return null;
}

interface CandidateRow {
  id: string;
  title: string;
  file_url: string;
  thumb_url: string | null;
  blurhash: string;
  dominant_color: string;
  palette: string[];
  width: number;
  height: number;
  like_count: number;
  download_count: number;
  view_count: number;
  trending_score: number;
  is_featured: boolean;
  is_premium: boolean;
  is_mobile: boolean;
  tags: string[];
  category_id: string | null;
  status: string;
  created_at: Date | string;
  format: string;
  file_size_bytes: number;
  creator_id: string | null;
  phash: string | null;
  vector_sim?: number;
}

/** Perceptual color distance using redmean approximation */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [128, 128, 128];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function colorDistance(hexA: string, hexB: string): number {
  if (!hexA || !hexB) return 1;
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  const dist = Math.sqrt(
    (2 + rMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rMean) / 256) * db * db
  );
  return Math.min(1, dist / 765);
}

/**
 * Builds the user aesthetic representation vector & profile from past interactions:
 * - Downloads (weight 4.0, 30-day half-life)
 * - Likes (weight 2.0, 14-day half-life)
 * - Onboarding interests (weight 1.5, position-adjusted)
 * - Guest session interaction IDs (weight 2.5)
 */
async function buildUserProfile(userId?: string | null, guestIds: string[] = []): Promise<{
  vector: Float32Array | null;
  preferredCategories: Map<string, number>;
  preferredTags: Map<string, number>;
  preferredColors: string[];
  excludedIds: Set<string>;
  totalSignals: number;
}> {
  const preferredCategories = new Map<string, number>();
  const preferredTags = new Map<string, number>();
  const colorWeights = new Map<string, number>();
  const excludedIds = new Set<string>();

  const signalItems: {
    embedding: number[];
    weight: number;
  }[] = [];

  // 1. Fetch user signals if authenticated
  if (userId) {
    // 1a. User downloads (highest intent signal)
    const downloadRows = await db.execute(sql`
      SELECT 
        w.id,
        w.text_embedding,
        w.category_id,
        w.tags,
        w.dominant_color,
        d.created_at,
        4.0 AS base_weight
      FROM downloads d
      JOIN wallpapers w ON w.id = d.wallpaper_id
      WHERE d.user_id = ${userId}::uuid
        AND w.text_embedding IS NOT NULL
        AND w.status = 'approved'
      ORDER BY d.created_at DESC
      LIMIT 30
    `);

    // 1b. User likes (explicit approval)
    const likeRows = await db.execute(sql`
      SELECT 
        w.id,
        w.text_embedding,
        w.category_id,
        w.tags,
        w.dominant_color,
        l.created_at,
        2.0 AS base_weight
      FROM likes l
      JOIN wallpapers w ON w.id = l.wallpaper_id
      WHERE l.user_id = ${userId}::uuid
        AND w.text_embedding IS NOT NULL
        AND w.status = 'approved'
      ORDER BY l.created_at DESC
      LIMIT 30
    `);

    // 1c. User onboarding categories
    const interestRows = await db.execute(sql`
      SELECT 
        w.id,
        w.text_embedding,
        w.category_id,
        w.tags,
        w.dominant_color,
        ui.created_at,
        (1.8 / GREATEST(ui.position, 1)::float) AS base_weight
      FROM user_interests ui
      JOIN wallpapers w ON w.category_id = ui.category_id
      WHERE ui.user_id = ${userId}::uuid
        AND w.status = 'approved'
        AND (w.is_featured = true OR w.trending_score > 5)
        AND w.text_embedding IS NOT NULL
      ORDER BY w.trending_score DESC
      LIMIT 12
    `);

    const allRows = [
      ...(downloadRows as unknown as UserSignalRow[]),
      ...(likeRows as unknown as UserSignalRow[]),
      ...(interestRows as unknown as UserSignalRow[]),
    ];

    const now = Date.now();
    for (const row of allRows) {
      const parsedEmbedding = parseVector(row.text_embedding);
      if (!row.id || !parsedEmbedding) continue;

      const baseWeight = Number(row.base_weight) || 2.0;

      // Exclude already downloaded wallpapers from discovery
      if (baseWeight >= 4.0) {
        excludedIds.add(row.id);
      }

      // Time decay: 14-day exponential half-life
      const itemTime = row.created_at ? new Date(row.created_at).getTime() : now;
      const ageInDays = Math.max(0, (now - itemTime) / (1000 * 60 * 60 * 24));
      const decay = Math.exp(-0.05 * ageInDays);
      const effectiveWeight = baseWeight * decay;

      signalItems.push({
        embedding: parsedEmbedding,
        weight: effectiveWeight,
      });

      if (row.category_id) {
        preferredCategories.set(
          row.category_id,
          (preferredCategories.get(row.category_id) || 0) + effectiveWeight
        );
      }

      if (Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          const t = tag.trim().toLowerCase();
          if (t) {
            preferredTags.set(t, (preferredTags.get(t) || 0) + effectiveWeight);
          }
        }
      }

      if (row.dominant_color) {
        colorWeights.set(
          row.dominant_color,
          (colorWeights.get(row.dominant_color) || 0) + effectiveWeight
        );
      }
    }
  }

  // 2. Fetch guest signals if provided
  if (guestIds.length > 0) {
    const validGuestIds = guestIds.slice(0, 15);
    const guestRows = await db.execute(sql`
      SELECT 
        id,
        text_embedding,
        category_id,
        tags,
        dominant_color,
        NOW() AS created_at,
        2.5 AS base_weight
      FROM wallpapers
      WHERE id IN (${sql.join(validGuestIds.map((id) => sql`${id}::uuid`), sql`, `)})
        AND text_embedding IS NOT NULL
        AND status = 'approved'
      LIMIT 15
    `);

    for (const row of guestRows as unknown as UserSignalRow[]) {
      const parsedEmbedding = parseVector(row.text_embedding);
      if (!row.id || !parsedEmbedding) continue;
      const weight = 2.5;

      signalItems.push({
        embedding: parsedEmbedding,
        weight,
      });

      if (row.category_id) {
        preferredCategories.set(
          row.category_id,
          (preferredCategories.get(row.category_id) || 0) + weight
        );
      }

      if (Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          const t = tag.trim().toLowerCase();
          if (t) preferredTags.set(t, (preferredTags.get(t) || 0) + weight);
        }
      }

      if (row.dominant_color) {
        colorWeights.set(
          row.dominant_color,
          (colorWeights.get(row.dominant_color) || 0) + weight
        );
      }
    }
  }

  // If no signals exist, return empty profile (cold start)
  if (signalItems.length === 0) {
    return {
      vector: null,
      preferredCategories,
      preferredTags,
      preferredColors: [],
      excludedIds,
      totalSignals: 0,
    };
  }

  // Compute weighted average 512-dim embedding vector
  const vector = new Float32Array(512);
  let totalWeight = 0;

  for (const item of signalItems) {
    const w = item.weight;
    for (let i = 0; i < 512; i++) {
      const embVal = item.embedding[i] ?? 0;
      vector[i] = (vector[i] ?? 0) + embVal * w;
    }
    totalWeight += w;
  }

  if (totalWeight > 0) {
    // Normalize to unit vector for cosine distance
    let norm = 0;
    for (let i = 0; i < 512; i++) {
      const val = (vector[i] ?? 0) / totalWeight;
      vector[i] = val;
      norm += val * val;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < 512; i++) {
        vector[i] = (vector[i] ?? 0) / norm;
      }
    }
  }

  // Extract top dominant colors
  const preferredColors = [...colorWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([col]) => col);

  return {
    vector,
    preferredCategories,
    preferredTags,
    preferredColors,
    excludedIds,
    totalSignals: signalItems.length,
  };
}

/**
 * Main personalized feed recommendation function
 */
export async function getPersonalizedFeed(params: PersonalizedFeedParams) {
  const { userId, guestIds = [], screen, limit, offset } = params;

  // Step 1 & 2: Build user profile & aggregate taste signals
  const profile = await buildUserProfile(userId, guestIds);
  const screenSql = screenFilterSql(screen);

  let candidateRows: CandidateRow[] = [];

  const excludedList = [...profile.excludedIds];
  const excludedSql =
    excludedList.length > 0
      ? sql`AND id NOT IN (${sql.join(excludedList.map((id) => sql`${id}::uuid`), sql`, `)})`
      : sql``;

  // Step 3: Candidate Retrieval
  if (profile.vector) {
    // Vector search using pgvector cosine distance
    const embStr = `[${Array.from(profile.vector).join(",")}]`;

    // Fetch top 120 candidates for re-ranking
    const candidates = await db.execute(sql`
      SELECT
        id, title, file_url, cdn_variants->'thumb'->>'url' AS thumb_url, blurhash, dominant_color,
        palette, width, height, like_count, download_count,
        view_count, trending_score, is_featured, is_premium, is_mobile,
        tags, category_id, status, created_at, format, file_size_bytes, ${creatorIdColumnSql},
        phash,
        (1 - (text_embedding <=> ${embStr}::vector)) AS vector_sim
      FROM wallpapers
      WHERE status = 'approved'
        AND text_embedding IS NOT NULL
        ${screenSql}
        ${visibleCategoryFilterSql}
        ${excludedSql}
      ORDER BY text_embedding <=> ${embStr}::vector ASC
      LIMIT 120
    `);

    candidateRows = candidates as unknown as CandidateRow[];
  } else {
    // Cold start fallback: blend trending, featured, and latest
    const fallbackCandidates = await db.execute(sql`
      SELECT
        id, title, file_url, cdn_variants->'thumb'->>'url' AS thumb_url, blurhash, dominant_color,
        palette, width, height, like_count, download_count,
        view_count, trending_score, is_featured, is_premium, is_mobile,
        tags, category_id, status, created_at, format, file_size_bytes, ${creatorIdColumnSql},
        phash,
        0.5 AS vector_sim
      FROM wallpapers
      WHERE status = 'approved'
        ${screenSql}
        ${visibleCategoryFilterSql}
        ${excludedSql}
      ORDER BY 
        (is_featured::int * 20.0 + trending_score) DESC,
        created_at DESC
      LIMIT 120
    `);

    candidateRows = fallbackCandidates as unknown as CandidateRow[];
  }

  // Step 4: Multi-Feature Scoring & Re-Ranking
  const scoredItems = candidateRows.map((item) => {
    // 1. Vector similarity (0 to 1) -> weight 0.45
    const vectorScore = Math.max(0, Math.min(1, Number(item.vector_sim) || 0.5)) * 0.45;

    // 2. Category Affinity Match -> weight 0.18
    let categoryScore = 0;
    if (item.category_id && profile.preferredCategories.has(item.category_id)) {
      const catWeight = profile.preferredCategories.get(item.category_id)!;
      categoryScore = Math.min(1, catWeight / 10.0) * 0.18;
    }

    // 3. Tag Jaccard overlap -> weight 0.12
    let tagScore = 0;
    if (Array.isArray(item.tags) && item.tags.length > 0 && profile.preferredTags.size > 0) {
      let matchCount = 0;
      for (const t of item.tags) {
        if (profile.preferredTags.has(t.trim().toLowerCase())) matchCount++;
      }
      tagScore = (matchCount / Math.max(1, item.tags.length)) * 0.12;
    }

    // 4. Color harmony -> weight 0.10
    let colorScore = 0;
    if (item.dominant_color && profile.preferredColors.length > 0) {
      const minDistance = Math.min(
        ...profile.preferredColors.map((fav) => colorDistance(fav, item.dominant_color))
      );
      colorScore = (1 - minDistance) * 0.10;
    }

    // 5. Community Momentum (Normalized Trending Score) -> weight 0.10
    const rawTrending = Math.max(0, Number(item.trending_score) || 0);
    const trendingScore = Math.min(1, Math.log1p(rawTrending) / 5.0) * 0.10;

    // 6. Freshness bonus (uploaded within last 72 hours) -> weight 0.05
    let freshnessScore = 0;
    const createdAtMs = new Date(item.created_at).getTime();
    if (Date.now() - createdAtMs < 1000 * 60 * 60 * 72) {
      freshnessScore = 0.05;
    }

    const totalScore =
      vectorScore + categoryScore + tagScore + colorScore + trendingScore + freshnessScore;

    return {
      item,
      score: totalScore,
    };
  });

  // Sort candidates by combined score descending
  scoredItems.sort((a, b) => b.score - a.score);

  // Step 5: Diversity & pHash De-duplication
  const diverseList: CandidateRow[] = [];
  const recentPhashes: string[] = [];
  const recentCategories: string[] = [];

  for (const { item } of scoredItems) {
    // 1. Check visual perceptual duplicate using pHash
    if (item.phash) {
      let isDuplicate = false;
      for (const existingPhash of recentPhashes) {
        if (phashDistance(item.phash, existingPhash) <= 12) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) continue;
    }

    // 2. Prevent same category clustering (no more than 2 in a row)
    if (item.category_id && recentCategories.length >= 2) {
      const lastTwoSame =
        recentCategories[recentCategories.length - 1] === item.category_id &&
        recentCategories[recentCategories.length - 2] === item.category_id;
      if (lastTwoSame && scoredItems.length > diverseList.length + 10) {
        // Demote/skip for now to encourage diversity
        continue;
      }
    }

    diverseList.push(item);
    if (item.phash) recentPhashes.push(item.phash);
    if (item.category_id) recentCategories.push(item.category_id);
    if (recentPhashes.length > 20) recentPhashes.shift();
    if (recentCategories.length > 10) recentCategories.shift();
  }

  // Step 6: Paginate results
  const paged = diverseList.slice(offset, offset + limit);
  const hasMore = diverseList.length > offset + limit;

  // Format to standard Wallpaper object (matching types)
  const data = paged.map((row) => ({
    id: row.id,
    title: row.title,
    description: null,
    fileUrl: row.file_url,
    thumbUrl: row.thumb_url || row.file_url,
    blurhash: row.blurhash,
    dominantColor: row.dominant_color,
    palette: row.palette || [],
    width: row.width,
    height: row.height,
    likeCount: Number(row.like_count) || 0,
    downloadCount: Number(row.download_count) || 0,
    trendingScore: Number(row.trending_score) || 0,
    isFeatured: Boolean(row.is_featured),
    isPremium: Boolean(row.is_premium),
    isMobile: Boolean(row.is_mobile),
    tags: row.tags || [],
    categoryId: row.category_id,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    format: row.format,
    fileSizeBytes: Number(row.file_size_bytes) || 0,
    creatorId: row.creator_id,
  }));

  const profileStats: RecommendationProfile = {
    hasProfile: profile.vector !== null,
    interactionCount: profile.totalSignals,
    topCategories: [...profile.preferredCategories.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id),
    topTags: [...profile.preferredTags.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t),
    primaryColors: profile.preferredColors,
  };

  return {
    data,
    hasMore,
    profile: profileStats,
  };
}
