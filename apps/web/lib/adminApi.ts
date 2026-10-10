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
