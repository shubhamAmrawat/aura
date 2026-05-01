import { Category, request, Wallpaper } from "./api";

export type ScreenFilter = "mobile" | "tablet";
export type SearchApiMode = "semantic" | "keyword" | "hybrid" | "none";
export type SearchSuggestionSource = "editorial" | "trending-title" | "trending-tag";

export async function getCategories():Promise<Category[]>{
  const res = await request<{ data: Category[] }>("/api/categories");
  return res.data;
}

export async function getWallpapers(params:{
  limit?: number;
  offset?: number;
  category?: string;
  q?: string;
  featured?: boolean;
  screen?: ScreenFilter;
}):Promise<{data: Wallpaper[];count: number; hasMore: boolean}>{
  
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.category) query.set('category', params.category);
  if (params.q) query.set('q', params.q);
  if (params.featured) query.set('featured', 'true');
  if (params.screen) query.set("screen", params.screen);
  
  const qs = query.toString();
  return request<{ data: Wallpaper[]; count: number; hasMore: boolean }>(
    `/api/wallpapers${qs ? `?${qs}` : ""}`
  );
}

export async function getTrendingWallpapers(params: {
  limit?: number;
  offset?: number;
  screen?: ScreenFilter;
}): Promise<{ data: Wallpaper[]; count: number; hasMore: boolean }> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  if (params.screen) query.set("screen", params.screen);

  const qs = query.toString();
  return request<{ data: Wallpaper[]; count: number; hasMore: boolean }>(
    `/api/wallpapers/trending${qs ? `?${qs}` : ""}`
  );
}

export async function getWallpaperById(id: string):Promise<Wallpaper>{
  const res = await request<{ data: Wallpaper }>(`/api/wallpapers/${id}`);
  return res.data;
}

type SearchWallpaperApiItem = {
  id: string;
  title: string;
  description?: string | null;
  fileUrl?: string | null;
  file_url?: string | null;
  blurhash?: string | null;
  dominantColor?: string | null;
  dominant_color?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  likeCount?: number | string | null;
  like_count?: number | string | null;
  downloadCount?: number | string | null;
  download_count?: number | string | null;
  viewCount?: number | string | null;
  view_count?: number | string | null;
  trendingScore?: number | string | null;
  trending_score?: number | string | null;
  isFeatured?: boolean | null;
  is_featured?: boolean | null;
  isPremium?: boolean | null;
  is_premium?: boolean | null;
  isAiGenerated?: boolean | null;
  is_ai_generated?: boolean | null;
  isMobile?: boolean | null;
  is_mobile?: boolean | null;
  tags?: string[] | null;
  palette?: string[] | null;
  categoryId?: string | null;
  category_id?: string | null;
  status?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  format?: string | null;
  fileSizeBytes?: number | string | null;
  file_size_bytes?: number | string | null;
};

type SimilarWallpaperApiItem = {
  id: string;
  title: string;
  description?: string | null;
  file_url?: string | null;
  blurhash?: string | null;
  dominant_color?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  like_count?: number | string | null;
  download_count?: number | string | null;
  file_size_bytes?: number | string | null;
  palette?: string[] | null;
  tags?: string[] | null;
  format?: string | null;
  category_id?: string | null;
  is_ai_generated?: boolean | null;
  is_featured?: boolean | null;
  is_premium?: boolean | null;
  is_mobile?: boolean | null;
  view_count?: number | string | null;
  trending_score?: number | string | null;
  status?: string | null;
  created_at?: string | null;
};

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function mapSimilarWallpaper(item: SimilarWallpaperApiItem): Wallpaper {
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? null,
    fileUrl: item.file_url ?? "",
    blurhash: item.blurhash ?? "",
    dominantColor: item.dominant_color ?? "#0A0A0A",
    width: toNumber(item.width),
    height: toNumber(item.height),
    likeCount: toNumber(item.like_count),
    downloadCount: toNumber(item.download_count),
    fileSizeBytes: toNumber(item.file_size_bytes),
    palette: item.palette ?? [],
    tags: item.tags ?? [],
    format: item.format ?? "jpeg",
    categoryId: item.category_id ?? null,
    isAiGenerated: item.is_ai_generated ?? false,
    isFeatured: item.is_featured ?? false,
    isPremium: item.is_premium ?? false,
    isMobile: item.is_mobile ?? false,
    viewCount: toNumber(item.view_count),
    trendingScore: toNumber(item.trending_score),
    status: item.status ?? "approved",
    createdAt: item.created_at ?? "",
  };
}

function mapSearchWallpaper(item: SearchWallpaperApiItem): Wallpaper {
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? null,
    fileUrl: item.fileUrl ?? item.file_url ?? "",
    blurhash: item.blurhash ?? "",
    dominantColor: item.dominantColor ?? item.dominant_color ?? "#0A0A0A",
    width: toNumber(item.width),
    height: toNumber(item.height),
    likeCount: toNumber(item.likeCount ?? item.like_count),
    downloadCount: toNumber(item.downloadCount ?? item.download_count),
    fileSizeBytes: toNumber(item.fileSizeBytes ?? item.file_size_bytes),
    palette: item.palette ?? [],
    tags: item.tags ?? [],
    format: item.format ?? "jpeg",
    categoryId: item.categoryId ?? item.category_id ?? null,
    isAiGenerated: item.isAiGenerated ?? item.is_ai_generated ?? false,
    isFeatured: item.isFeatured ?? item.is_featured ?? false,
    isPremium: item.isPremium ?? item.is_premium ?? false,
    isMobile: item.isMobile ?? item.is_mobile ?? false,
    viewCount: toNumber(item.viewCount ?? item.view_count),
    trendingScore: toNumber(item.trendingScore ?? item.trending_score),
    status: item.status ?? "approved",
    createdAt: item.createdAt ?? item.created_at ?? "",
  };
}

export async function getSimilarWallpapers(
  id: string,
  screen?: ScreenFilter
):Promise<Wallpaper[]>{
  const query = new URLSearchParams();
  if (screen) query.set("screen", screen);
  const qs = query.toString();
  const res = await request<{ data: SimilarWallpaperApiItem[] }>(
    `/api/wallpapers/${id}/similar${qs ? `?${qs}` : ""}`
  );
  return res.data.map(mapSimilarWallpaper);
}

export async function searchWallpapers(params: {
  q: string;
  limit?: number;
  offset?: number;
  mode?: "semantic" | "keyword" | "hybrid";
  screen?: ScreenFilter;
}): Promise<{ data: Wallpaper[]; hasMore: boolean; mode: SearchApiMode }> {
  const query = new URLSearchParams();
  query.set("q", params.q);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  if (params.mode) query.set("mode", params.mode);
  if (params.screen) query.set("screen", params.screen);

  const qs = query.toString();
  const res = await request<{
    data: SearchWallpaperApiItem[];
    hasMore: boolean;
    mode: SearchApiMode;
  }>(`/api/search${qs ? `?${qs}` : ""}`);

  return {
    data: (res.data ?? []).map(mapSearchWallpaper),
    hasMore: Boolean(res.hasMore),
    mode: res.mode ?? "none",
  };
}

export async function getSearchSuggestions(params: {
  limit?: number;
  screen?: ScreenFilter;
}): Promise<Array<{ term: string; source: SearchSuggestionSource }>> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.screen) query.set("screen", params.screen);
  const qs = query.toString();

  const res = await request<{
    data: Array<{ term: string; source: SearchSuggestionSource }>;
  }>(`/api/search/suggestions${qs ? `?${qs}` : ""}`);

  return res.data ?? [];
}

export async function getSearchAutocomplete(params: {
  q: string;
  limit?: number;
  screen?: ScreenFilter;
}): Promise<string[]> {
  const query = new URLSearchParams();
  query.set("q", params.q);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.screen) query.set("screen", params.screen);
  const qs = query.toString();

  const res = await request<{ data: string[] }>(`/api/search/autocomplete${qs ? `?${qs}` : ""}`);
  return res.data ?? [];
}

export async function isWallpaperLiked(wallpaperId: string): Promise<boolean> {
  const res = await request<{ liked: boolean }>(`/api/likes/${wallpaperId}`);
  return res.liked;
}

export async function toggleWallpaperLike(
  wallpaperId: string
): Promise<{ liked: boolean; message: string }> {
  return request<{ liked: boolean; message: string }>(`/api/likes/${wallpaperId}`, {
    method: "POST",
  });
}