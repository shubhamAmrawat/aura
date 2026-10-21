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
  /** From /me: false for Google-only accounts (they confirm sensitive actions with an emailed code). */
  hasPassword?: boolean
  googleLinked?: boolean
}
/** Public profile of a creator who uploaded a wallpaper (admin uploads have none). */
export type Creator = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
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
  /** Uploader's id when a creator (not an admin) uploaded it; feeds include it so blocked creators can be hidden. */
  creatorId?: string | null
  /** Detail endpoint only: who uploaded it, null for admin uploads. */
  creator?: Creator | null
}

/** The fields a grid tile needs (feeds, likes, search all return at least these). */
export type WallpaperTile = Pick<Wallpaper, "id" | "title" | "fileUrl" | "blurhash" | "dominantColor" | "width" | "height"> & {
  thumbUrl?: string | null
  creatorId?: string | null
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
  if (!response.ok) throw new ApiError(await errorMessage(response), response.status);
  return response.json();
}

/** An error response from the API, with its HTTP status (network failures stay plain Errors). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * The API's `{ error }` message, or a readable fallback. Error bodies aren't always JSON: a
 * timeout from Cloudflare/Render (502/503/504) returns an HTML page or nothing at all.
 */
export async function errorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // not JSON
  }
  if (response.status >= 500) return "Aurora's server is busy right now. Please try again in a moment.";
  return "Request failed";
}