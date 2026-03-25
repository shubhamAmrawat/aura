export type WallpaperStatus = "pending" | "approved" | "rejected";
export type WallpaperFormat = "jpeg" | "png" | "webp" | "avif"; 

export interface Wallpaper {
  id: string;
  title: string;
  description: string | null;
  dominantColor: string;
  palette: string[];
  width: number;
  height: number;
  fileSizeBytes: number;
  format: WallpaperFormat;
  blurhash: string;
  fileUrl: string;
  tags: string[];
  isPremium: boolean;
  isFeatured: boolean;
  downloadCount: number;
  likeCount: number;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isCreator: boolean;
  isPro: boolean;
  totalDownloads: number;
  totalUploads: number;
}

export interface Collection {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  wallpaperCount: number;
  createdAt: string;
}