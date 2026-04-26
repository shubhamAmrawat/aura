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
  isCreator?: boolean
  isPro?: boolean
  totalDownloads?: number
  totalUploads?: number
  createdAt?: string
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
}
export type Category = {
  id: string
  name: string
  slug: string
  description?: string | null
  coverImageUrl: string | null
  sortOrder?: number
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