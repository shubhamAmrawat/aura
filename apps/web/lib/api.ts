import { Wallpaper } from "@aura/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
interface Category {
  id: string;
  name: string;
  slug: string;
}

function getApiUrl(): string {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  return API_URL;
}

async function fetchJsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}) for ${url}${body ? `: ${body.slice(0, 240)}` : ""}`);
  }
  return (await response.json()) as T;
}

export async function getWallpapers(params?: {
  category?: string;
  q?: string;
  limit?: number;
}): Promise<Wallpaper[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.q) query.set("q", params.q);
  if (params?.limit) query.set("limit", String(params.limit));

  const url = `${getApiUrl()}/api/wallpapers${query.toString() ? `?${query}` : ""}`;
  const { data } = await fetchJsonOrThrow<{ data: Wallpaper[] }>(url, { cache: "no-store" });
  return data;
}
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