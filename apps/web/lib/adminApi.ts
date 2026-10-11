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
