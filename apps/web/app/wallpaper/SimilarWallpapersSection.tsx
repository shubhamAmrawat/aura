"use client";

import { useState } from "react";
import { Wallpaper } from "@aura/types";
import WallpaperCard from "@/app/components/WallpaperCard";

export type SimilarSqlRow = {
  id: string;
  title: string;
  file_url: string;
  blurhash?: string | null;
  dominant_color: string;
  width: number | string;
  height: number | string;
  like_count: number | string;
  download_count: number | string;
};

const PAGE_SIZE = 24;

function mapRows(wallpapers: SimilarSqlRow[]): Wallpaper[] {
  return wallpapers.map((w) => ({
    id: w.id,
    title: w.title,
    description: null,
    fileUrl: w.file_url,
    blurhash: w.blurhash ?? "",
    dominantColor: w.dominant_color,
    width: Number(w.width),
    height: Number(w.height),
    likeCount: Number(w.like_count),
    downloadCount: Number(w.download_count),
    palette: [],
    tags: [],
    format: "jpeg",
    fileSizeBytes: 0,
    isFeatured: false,
    isPremium: false,
    isMobile: Number(w.height ?? 0) >= Number(w.width ?? 1),
    createdAt: new Date().toISOString(),
  }));
}

/** Drop duplicate ids and duplicate file URLs (re-uploads), preserving order. */
function dedupeSimilarRows(rows: SimilarSqlRow[]): SimilarSqlRow[] {
  const seenId = new Set<string>();
  const seenUrl = new Set<string>();
  const out: SimilarSqlRow[] = [];
  for (const r of rows) {
    const id = String(r.id);
    const url = String(r.file_url ?? "").trim();
    if (seenId.has(id)) continue;
    seenId.add(id);
    if (url && seenUrl.has(url)) continue;
    if (url) seenUrl.add(url);
    out.push(r);
  }
  return out;
}

function mergeSimilarRows(
  prev: SimilarSqlRow[],
  batch: SimilarSqlRow[]
): SimilarSqlRow[] {
  return dedupeSimilarRows([...prev, ...batch]);
}

async function fetchSimilarClient(
  wallpaperId: string,
  offset: number,
  limit: number
): Promise<{ data: SimilarSqlRow[]; hasMore: boolean }> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) return { data: [], hasMore: false };
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(
    `${apiBase}/api/wallpapers/${encodeURIComponent(wallpaperId)}/similar?${qs}`,
    { credentials: "include", cache: "no-store" }
  );
  if (!res.ok) return { data: [], hasMore: false };
  const json = (await res.json()) as {
    data?: SimilarSqlRow[];
    hasMore?: boolean;
  };
  return {
    data: json.data ?? [],
    hasMore: Boolean(json.hasMore),
  };
}

export function SimilarWallpapersSection({
  wallpaperId,
  initialWallpapers,
  initialHasMore,
}: {
  wallpaperId: string;
  initialWallpapers: SimilarSqlRow[];
  initialHasMore: boolean;
}) {
  const [rows, setRows] = useState<SimilarSqlRow[]>(() =>
    dedupeSimilarRows(initialWallpapers)
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialWallpapers.length);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const { data, hasMore: more } = await fetchSimilarClient(
        wallpaperId,
        nextOffset,
        PAGE_SIZE
      );
      setRows((prev) => mergeSimilarRows(prev, data));
      setNextOffset((o) => o + data.length);
      setHasMore(more);
    } catch {
      /* keep button for retry */
    } finally {
      setLoading(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div
        className="px-8 md:px-12 py-10"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="max-w-[1400px] mx-auto">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            No similar wallpapers yet (similarity index unavailable for this image).
          </p>
        </div>
      </div>
    );
  }

  const mapped = mapRows(rows);

  return (
    <div
      className="px-8 md:px-12 py-16"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-8">
          <h2
            className="text-base font-semibold tracking-[0.15em] uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            Similar Vibes
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            Visually similar wallpapers from our collection
          </p>
        </div>

        {/* <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
          {rows.length} wallpaper{rows.length !== 1 ? "s" : ""} loaded
          {hasMore ? " — more available" : ""}
        </p> */}

        <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
          {mapped.map((w, index) => (
            <div key={w.id} className="break-inside-avoid mb-4">
              <WallpaperCard wallpaper={w} priority={index === 0} />
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="flex justify-center mt-12">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loading}
              className="flex items-center gap-3 px-8 py-3 rounded-full text-sm font-medium transition-all hover:opacity-80 disabled:opacity-40"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                background: "var(--bg-elevated)",
              }}
            >
              {loading ? (
                <>
                  <div
                    className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{
                      borderColor: "var(--border)",
                      borderTopColor: "var(--accent)",
                    }}
                  />
                  Loading...
                </>
              ) : (
                "Load more"
              )}
            </button>
          </div>
        )}

        {!hasMore && rows.length > 0 && (
          <p
            className="mt-12 text-center text-xs tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            All {rows.length} similar wallpapers loaded
          </p>
        )}
      </div>
    </div>
  );
}
