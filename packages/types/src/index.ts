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
  /** 600px WebP for grids and cards; null/absent until made — fall back to fileUrl. */
  thumbUrl?: string | null;
  tags: string[];
  isPremium: boolean;
  isFeatured: boolean;
  isMobile: boolean;
  /** Present on single-wallpaper responses. */
  categoryId?: string | null;
  /** Extra categories it is also listed in (single-wallpaper responses). */
  extraCategoryIds?: string[];
  downloadCount: number;
  likeCount: number;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isEmailVerified: boolean;
  isCreator: boolean;
  isPro: boolean;
  totalDownloads: number;
  totalUploads: number;
  createdAt: string;
  /** "admin" can open /admin (API enforces it) */
  role?: "user" | "admin";
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

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}