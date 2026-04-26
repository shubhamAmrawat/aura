import { Category, request, Wallpaper } from "./api";


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
}):Promise<{data: Wallpaper[];count: number; hasMore: boolean}>{
  
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.category) query.set('category', params.category);
  if (params.q) query.set('q', params.q);
  if (params.featured) query.set('featured', 'true');
  
  const qs = query.toString();
  return request<{ data: Wallpaper[]; count: number; hasMore: boolean }>(
    `/api/wallpapers${qs ? `?${qs}` : ""}`
  );
}

export async function getWallpaperById(id: string):Promise<Wallpaper>{
  const res = await request<{ data: Wallpaper }>(`/api/wallpapers/${id}`);
  return res.data;
}

export async function getSimilarWallpapers(id: string):Promise<Wallpaper[]>{
  const res = await request<{ data: Wallpaper[] }>(`/api/wallpapers/${id}/similar`);
  return res.data;
}