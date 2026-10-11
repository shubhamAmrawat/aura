// Admin API client. Every call is checked server-side (role = admin).

const API = process.env.NEXT_PUBLIC_API_URL;

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api/admin${path}`, { credentials: "include", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export type AdminOverview = {
  users: { total: number; new7d: number; new30d: number; creators: number; admins: number };
  wallpapers: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    featured: number;
    new7d: number;
    new30d: number;
    storageBytes: number;
  };
  downloads: { total: number; logged: number; last7d: number; last30d: number };
  views: { total: number };
  likes: { total: number; last7d: number; last30d: number };
  generatedAt: string;
};

export const getAdminOverview = () => adminGet<AdminOverview>("/stats/overview");

// ─── Dashboard (Overview page) ──────────────────────────────

export type DashboardDay = { day: string; downloads: number; views: number; likes: number; signups: number; uploads: number };
export type Kpi = { last7d: number; prev7d: number; spark: number[] };
export type TopItem = { id: string; title: string; fileUrl: string; dominantColor: string; count: number };
export type SourceSplit = { web: number; mobile: number; unknown: number };

export type AdminDashboard = {
  days: 7 | 30 | 90;
  timezone: string;
  totals: { liveWallpapers: number; users: number; creators: number; pending: number; downloads: number; views: number; likes: number };
  kpis: Record<"downloads" | "views" | "likes" | "signups" | "uploads", Kpi>;
  series: DashboardDay[];
  attention: { pending: number; oldestPendingAt: string | null; rejected: number; rejectedExpiringSoon: number; storageBytes: number };
  categories: { id: string; name: string; wallpapers: number; downloads: number }[];
  top: Record<"downloads" | "likes" | "views", TopItem[]>;
  platform: Record<"downloads" | "views", SourceSplit>;
  recent: { kind: "signup" | "upload" | "admin"; at: string; who: string; what: string | null; ref: string | null }[];
  generatedAt: string;
};

export const getAdminDashboard = (days: 7 | 30 | 90) => adminGet<AdminDashboard>(`/stats/dashboard?days=${days}`);

async function adminPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/api/admin${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

// ─── Review queue ───────────────────────────────────────────

export type ReviewStatus = "pending" | "rejected";

export type ReviewItem = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  blurhash: string;
  dominantColor: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  format: string;
  tags: string[];
  isMobile: boolean;
  isAiGenerated: boolean;
  status: ReviewStatus | "approved";
  moderationReason: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  purgeAt: string | null;
  category: { id: string; name: string } | null;
  uploader: { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
};

export type ReviewPage = { data: ReviewItem[]; total: number; hasMore: boolean };

export const getReviewQueue = (status: ReviewStatus, offset = 0, limit = 24) =>
  adminGet<ReviewPage>(`/review?status=${status}&limit=${limit}&offset=${offset}`);

export const approveWallpaper = (id: string) => adminPost<{ id: string; status: string }>(`/review/${id}/approve`);

export const rejectWallpaper = (id: string, reason: string) =>
  adminPost<{ id: string; status: string }>(`/review/${id}/reject`, { reason });

export type BulkResult = { action: string; succeeded: number; failed: number; results: { id: string; ok: boolean; error?: string }[] };

export const bulkReview = (ids: string[], action: "approve" | "reject", reason?: string) =>
  adminPost<BulkResult>("/review/bulk", { ids, action, reason });

// ─── Wallpaper management ───────────────────────────────────

async function adminSend<T>(method: "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/api/admin${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export type AdminWallpaper = {
  id: string;
  title: string;
  fileUrl: string;
  dominantColor: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  format: string;
  status: "approved" | "pending" | "rejected";
  tags: string[];
  isFeatured: boolean;
  isPremium: boolean;
  isMobile: boolean;
  isAiGenerated: boolean;
  downloadCount: number;
  likeCount: number;
  viewCount: number;
  trendingScore: number;
  createdAt: string;
  category: { id: string; name: string } | null;
  uploader: { id: string; username: string } | null;
};

export type AdminWallpaperDetail = AdminWallpaper & {
  description: string | null;
  palette: string[];
  moderationReason: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  rejectedAt: string | null;
  updatedAt: string;
  hasVisionEmbedding: boolean;
  hasTextEmbedding: boolean;
};

export type Resolution = "4k" | "qhd" | "fhd" | "hd" | "low";

/** Same tiers as the API: by the image's longer edge. */
export const RESOLUTIONS: { value: Resolution; label: string; hint: string; min: number }[] = [
  { value: "4k", label: "4K+", hint: "3840px and up", min: 3840 },
  { value: "qhd", label: "QHD", hint: "2560–3839px", min: 2560 },
  { value: "fhd", label: "Full HD", hint: "1920–2559px", min: 1920 },
  { value: "hd", label: "HD", hint: "1280–1919px", min: 1280 },
  { value: "low", label: "Low", hint: "under 1280px", min: 0 },
];

export const resolutionOf = (w: number, h: number) => RESOLUTIONS.find((r) => Math.max(w, h) >= r.min)!;

export type WallpaperFilters = {
  q?: string;
  status?: "all" | "approved" | "pending" | "rejected";
  categoryId?: string;
  uploader?: string;
  featured?: "true" | "false";
  premium?: "true" | "false";
  mobile?: "true" | "false";
  ai?: "true" | "false";
  resolution?: Resolution;
  sort?: "newest" | "oldest" | "downloads" | "likes" | "views" | "trending" | "title";
  limit?: number;
  offset?: number;
};

export function listAdminWallpapers(f: WallpaperFilters) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return adminGet<{ data: AdminWallpaper[]; total: number; hasMore: boolean }>(`/wallpapers?${qs}`);
}

export const getAdminWallpaper = (id: string) => adminGet<AdminWallpaperDetail>(`/wallpapers/${id}`);

export type WallpaperPatch = Partial<{
  title: string;
  description: string | null;
  tags: string[];
  categoryId: string | null;
  isFeatured: boolean;
  isPremium: boolean;
  isMobile: boolean;
  isAiGenerated: boolean;
}>;

export const updateAdminWallpaper = (id: string, patch: WallpaperPatch) =>
  adminSend<AdminWallpaperDetail>("PATCH", `/wallpapers/${id}`, patch);

export const deleteAdminWallpaper = (id: string) => adminSend<{ id: string; deleted: true }>("DELETE", `/wallpapers/${id}`);

export type WallpaperBulkAction = "feature" | "unfeature" | "setCategory" | "addTags" | "removeTags" | "delete";

export const bulkUpdateWallpapers = (ids: string[], action: WallpaperBulkAction, opts: { categoryId?: string | null; tags?: string[] } = {}) =>
  adminPost<BulkResult>("/wallpapers/bulk", { ids, action, ...opts });

export type CategoryOption = { id: string; name: string; slug: string };

export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const res = await fetch(`${API}/api/categories`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to load categories");
  return (data.data ?? []) as CategoryOption[];
}

// ─── Featured (home page hero) ──────────────────────────────

export type FeaturedItem = {
  id: string;
  title: string;
  fileUrl: string;
  dominantColor: string;
  width: number;
  height: number;
  format: string;
  tags: string[];
  status: "approved" | "pending" | "rejected";
  isMobile: boolean;
  featuredOrder: number | null;
  createdAt: string;
};
export type FeaturedState = { limit: number; maxLimit: number; items: FeaturedItem[] };

async function adminPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}/api/admin${path}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export const getFeatured = () => adminGet<FeaturedState>("/featured");
export const saveFeaturedOrder = (ids: string[]) => adminPut<FeaturedState>("/featured/order", { ids });
export const saveFeaturedLimit = (limit: number) => adminPut<FeaturedState>("/featured/limit", { limit });

/** Ask the web app to refresh the cached home-page hero right away (same-origin, admin cookie). */
export async function refreshHomeHero(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/revalidate-featured", { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}
