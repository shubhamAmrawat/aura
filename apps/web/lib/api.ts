import { cache } from "react";
import { User, Wallpaper } from "@aura/types";

/** Keep server initial fetch and client infinite scroll in sync. */
export const WALLPAPERS_FEED_PAGE_SIZE = 24;

const API_URL = process.env.NEXT_PUBLIC_API_URL;
interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

function getApiUrl(): string {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  return API_URL;
}

async function fetchJsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}) for ${url}${body ? `: ${body.slice(0, 240)}` : ""}`);
  }
  return (await response.json()) as T;
}

function wallpapersListUrl(params?: {
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
  featured?: boolean;
  cursor?: string;
}): string {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.q) query.set("q", params.q);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.featured) query.set("featured", "true");
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  return `${getApiUrl()}/api/wallpapers${qs ? `?${qs}` : ""}`;
}

export type GetWallpapersParams = {
  limit?: number;
  featured?: boolean;
  category?: string;
  q?: string;
  cursor?: string;
  offset?: number;
};

export async function getWallpapers(
  params?: GetWallpapersParams
): Promise<{ data: Wallpaper[]; hasMore: boolean }> {
  const url = wallpapersListUrl(params);
  const json = await fetchJsonOrThrow<{ data: Wallpaper[]; hasMore?: boolean }>(url, {
    next: { revalidate: 60, tags: ["wallpapers"] },
  });
  return { data: json.data, hasMore: Boolean(json.hasMore) };
}

/** Paginated list for infinite scroll; uses `hasMore` from the API. */
export const getWallpapersPage = getWallpapers;

export async function getFeaturedWallpapers(): Promise<Wallpaper[]> {
  const { data } = await fetchJsonOrThrow<{ data: Wallpaper[] }>(
    `${getApiUrl()}/api/wallpapers?featured=true&limit=5`,
    { next: { revalidate: 120, tags: ["wallpapers", "featured"] } }
  );
  return data;
}

/**
 * Wrapped with React.cache() so that generateMetadata and the page component
 * that both call this for the same `id` within a single render share one fetch.
 */
export const getWallpaperById = cache(async (id: string): Promise<Wallpaper> => {
  const { data } = await fetchJsonOrThrow<{ data: Wallpaper }>(
    `${getApiUrl()}/api/wallpapers/${id}`,
    { next: { revalidate: 300, tags: ["wallpapers", `wallpaper-${id}`] } }
  );
  return data;
});

const SIMILAR_PAGE_DEFAULT = 24;

/** Visual similarity (snake_case rows). Paginated like trending/latest. */
export async function getSimilarWallpapersPage(
  id: string,
  params?: { limit?: number; offset?: number }
): Promise<{ data: Record<string, unknown>[]; hasMore: boolean }> {
  const limit = params?.limit ?? SIMILAR_PAGE_DEFAULT;
  const offset = params?.offset ?? 0;
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const url = `${getApiUrl()}/api/wallpapers/${encodeURIComponent(id)}/similar?${qs}`;
  const json = await fetchJsonOrThrow<{
    data: Record<string, unknown>[];
    hasMore?: boolean;
  }>(url, { next: { revalidate: 1800 } });
  return { data: json.data ?? [], hasMore: Boolean(json.hasMore) };
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await fetchJsonOrThrow<{ data: Category[] }>(
    `${getApiUrl()}/api/categories`,
    { next: { revalidate: 86400 } }
  );
  return data;
}


export async function getUploadUrl(fileType: string): Promise<{
  uploadUrl: string;
  fileUrl: string;
  key: string;
}> {
  const res = await fetch(`${getApiUrl()}/api/wallpapers/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fileType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to get upload URL");
  return data;
}

export async function submitWallpaper(payload: {
  title: string;
  description: string;
  categoryId: string;
  tags: string[];
  fileUrl: string;
  key: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  fileType: string;
}): Promise<{ wallpaper: Wallpaper; moderationStatus: string; message: string }> {
  const res = await fetch(`${getApiUrl()}/api/wallpapers/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to upload wallpaper");
  return data;
}

export async function becomeCreator(): Promise<{ user: User }> {
  const res = await fetch(`${getApiUrl()}/api/auth/become-creator`, {
    method: "PUT",
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

export async function getTrendingWallpapers(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ data: Wallpaper[]; hasMore: boolean }> {
  const url = new URL(`${getApiUrl()}/api/wallpapers/trending`);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));

  const json = await fetchJsonOrThrow<{ data: Wallpaper[]; hasMore?: boolean }>(
    url.toString(),
    { next: { revalidate: 60, tags: ["wallpapers", "trending"] } }
  );
  return { data: json.data, hasMore: Boolean(json.hasMore) };
}

export type SearchApiMode = "semantic" | "keyword" | "hybrid" | "none";

export async function semanticSearch(params: {
  q: string;
  limit?: number;
  offset?: number;
  mode?: "semantic" | "keyword" | "hybrid";
}): Promise<{ data: Record<string, unknown>[]; hasMore: boolean; mode: SearchApiMode }> {
  const url = new URL(`${getApiUrl()}/api/search`);
  url.searchParams.set("q", params.q);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  url.searchParams.set("mode", params.mode ?? "hybrid");

  // Search results are query-specific — never cache
  const res = await fetchJsonOrThrow<{
    data: Record<string, unknown>[];
    hasMore: boolean;
    mode: SearchApiMode;
  }>(url.toString(), { cache: "no-store" });

  return res;
}
