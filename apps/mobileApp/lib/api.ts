import { getToken } from "./tokenStorage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
console.log("BASE URL:",BASE_URL);
export type User = {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl?: string | null
  coverUrl?: string | null
  bio?: string | null
  contactNo?: string | null
  isCreator?: boolean
  isPro?: boolean
  totalDownloads?: number
  totalUploads?: number
  usernameChangedAt?: string | null
  createdAt?: string
  role?: "user" | "admin"
}
export type Wallpaper = {
  id: string
  title: string
  description: string | null
  fileUrl: string
  blurhash: string
  dominantColor: string
  palette: string[]
  width: number
  height: number
  fileSizeBytes: number
  format: string
  downloadCount: number
  likeCount: number
  isMobile: boolean
  viewCount: number
  trendingScore: number
  isFeatured: boolean
  isPremium: boolean
  isAiGenerated: boolean
  tags: string[]
  categoryId: string | null
  status: string
  createdAt: string
  /** 600px WebP for grids (null until generated); fileUrl is the full original. */
  thumbUrl?: string | null
  /** Up to 2 extra categories (detail endpoint only). */
  extraCategoryIds?: string[]
}

/** The fields a grid tile needs (feeds, likes, search all return at least these). */
export type WallpaperTile = Pick<Wallpaper, "id" | "title" | "fileUrl" | "blurhash" | "dominantColor" | "width" | "height"> & {
  thumbUrl?: string | null
}
export type Category = {
  id: string
  name: string
  slug: string
  description?: string | null
  coverImageUrl: string | null
  coverThumbUrl?: string | null
  sortOrder?: number
  wallpaperCount?: number
}

export type CategoryDetails = {
  slug: string
  name: string
  description: string | null
  intro: string | null
}
export async function request<T>(
  path:string , 
  options:RequestInit = {}
):Promise<T>{
  const token = await getToken(); 
  const headers:Record<string,string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if(token){
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(BASE_URL+path, {
    ...options,
    headers,
  });
  if(!response.ok){ 
    const error = await response.json();
    throw new Error(error.error || "Request failed");
  } 
  return response.json();
}