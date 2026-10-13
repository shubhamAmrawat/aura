import { cache } from "react";
import { User, Wallpaper } from "@aura/types";
import { screenFor, type Device } from "./device";

/** Keep server initial fetch and client infinite scroll in sync. */
export const WALLPAPERS_FEED_PAGE_SIZE = 24;

const API_URL = process.env.NEXT_PUBLIC_API_URL;
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  /** Small webp for menus (null until one is made, or when the category is empty). */
  coverThumbUrl?: string | null;
  /** Live wallpapers in the category (absent on older API versions). */
  wallpaperCount?: number;
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
  device?: Device;
}): string {
  const query = new URLSearchParams();
  const screen = screenFor(params?.device);
  if (screen) query.set("screen", screen);
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
  /** Phone / desktop filter (the visitor's choice); omit for everything. */
  device?: Device;
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

/** Home page hero: admin-chosen order and count. Refreshed instantly when an admin saves (tag "featured"). */
export async function getFeaturedWallpapers(): Promise<Wallpaper[]> {
  const init = { next: { revalidate: 120, tags: ["wallpapers", "featured"] } };
  try {
    const { data } = await fetchJsonOrThrow<{ data: Wallpaper[] }>(`${getApiUrl()}/api/featured`, init);
    return data;
  } catch {
    // Older API without /api/featured: fall back to the previous behaviour
    const { data } = await fetchJsonOrThrow<{ data: Wallpaper[] }>(`${getApiUrl()}/api/wallpapers?featured=true&limit=5`, init);
    return data;
  }
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

/** Current slug for a category slug that was renamed or merged away; null if unknown. */
export async function resolveCategorySlug(slug: string): Promise<string | null> {
  try {
    const res = await fetch(`${getApiUrl()}/api/categories/resolve/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600, tags: ["categories"] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { slug?: string };
    return data.slug ?? null;
  } catch {
    return null;
  }
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await fetchJsonOrThrow<{ data: Category[] }>(
    `${getApiUrl()}/api/categories`,
    { next: { revalidate: 86400, tags: ["categories"] } }
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
  device?: Device;
}): Promise<{ data: Wallpaper[]; hasMore: boolean }> {
  const url = new URL(`${getApiUrl()}/api/wallpapers/trending`);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));
  const screen = screenFor(params?.device);
  if (screen) url.searchParams.set("screen", screen);

  const json = await fetchJsonOrThrow<{ data: Wallpaper[]; hasMore?: boolean }>(
    url.toString(),
    { next: { revalidate: 60, tags: ["wallpapers", "trending"] } }
  );
  return { data: json.data, hasMore: Boolean(json.hasMore) };
}

/** Type-ahead terms for the search box (client side). */
export async function getAutocomplete(q: string, device?: Device, signal?: AbortSignal): Promise<string[]> {
  const url = new URL(`${getApiUrl()}/api/search/autocomplete`);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  const screen = screenFor(device);
  if (screen) url.searchParams.set("screen", screen);
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: string[] };
  return json.data ?? [];
}

/** Popular searches shown when the search box is empty (client side). */
export async function getSearchSuggestions(device?: Device): Promise<string[]> {
  const url = new URL(`${getApiUrl()}/api/search/suggestions`);
  url.searchParams.set("limit", "6");
  const screen = screenFor(device);
  if (screen) url.searchParams.set("screen", screen);
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { term: string }[] };
  return (json.data ?? []).map((d) => d.term);
}

export type SearchApiMode = "semantic" | "keyword" | "hybrid" | "none";

export async function semanticSearch(params: {
  q: string;
  limit?: number;
  offset?: number;
  mode?: "semantic" | "keyword" | "hybrid";
  device?: Device;
}): Promise<{ data: Record<string, unknown>[]; hasMore: boolean; mode: SearchApiMode }> {
  const url = new URL(`${getApiUrl()}/api/search`);
  url.searchParams.set("q", params.q);
  const screen = screenFor(params.device);
  if (screen) url.searchParams.set("screen", screen);
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
