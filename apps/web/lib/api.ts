import { Wallpaper } from "@aura/types";

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
    cache: "no-store",
  });
  return { data: json.data, hasMore: Boolean(json.hasMore) };
}

/** Paginated list for infinite scroll; uses `hasMore` from the API. */
export const getWallpapersPage = getWallpapers;

export async function getFeaturedWallpapers(): Promise<Wallpaper[]> {
  const { data } = await fetchJsonOrThrow<{ data: Wallpaper[] }>(
    `${getApiUrl()}/api/wallpapers?featured=true&limit=5`,
    { cache: "no-store" }
  );
  return data;
}
export async function getWallpaperById(id:string): Promise<Wallpaper> {
  const { data } = await fetchJsonOrThrow<{ data: Wallpaper }>(`${getApiUrl()}/api/wallpapers/${id}`, { cache: "no-store" });
  return data; 
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await fetchJsonOrThrow<{ data: Category[] }>(`${getApiUrl()}/api/categories`, { cache: "force-cache" });
  return data; 
}