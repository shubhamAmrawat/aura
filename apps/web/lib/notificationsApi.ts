// Notifications inbox (bell + /notifications). Signed in: your own notifications plus
// broadcasts; signed out: broadcasts only, with "seen" kept in this browser.

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const SEEN_KEY = "aura_notifications_seen";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  /** a path (/wallpaper/…, /collection/…), an https link, or null */
  url: string | null;
  actions: { id: string; label: string; url: string }[];
  createdAt: string;
};

export type InboxPage = { data: NotificationItem[]; hasMore: boolean; seenAt: string; unread: number };

function localSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function query(params: Record<string, string | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function getUnreadCount(screen: string | undefined, signedIn: boolean): Promise<number> {
  const res = await fetch(`${API_URL}/api/notifications/unread${query({ screen, since: signedIn ? null : localSeen() })}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) return 0;
  const data = await res.json().catch(() => ({}));
  return typeof data.unread === "number" ? data.unread : 0;
}

export async function getInbox(opts: { screen?: string; signedIn: boolean; before?: string; limit?: number }): Promise<InboxPage> {
  const url = `${API_URL}/api/notifications${query({ screen: opts.screen, since: opts.signedIn ? null : localSeen(), before: opts.before, limit: String(opts.limit ?? 20) })}`;
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't load notifications");
  return data as InboxPage;
}

/** Everything up to now counts as seen (account, or this browser when signed out). */
export async function markSeen(signedIn: boolean) {
  if (!signedIn) {
    try {
      localStorage.setItem(SEEN_KEY, new Date().toISOString());
    } catch {
      /* private mode */
    }
    return;
  }
  await fetch(`${API_URL}/api/notifications/seen`, { method: "POST", credentials: "include" }).catch(() => undefined);
}

/** Where a notification goes on the website: its page, an https link, or the inbox. */
export function webHref(url: string | null): { href: string; external: boolean } {
  if (url && url.startsWith("https://")) {
    const site = url.match(/^https:\/\/(www\.)?aurora-walls\.com(\/.*)?$/);
    return site ? { href: site[2] || "/", external: false } : { href: url, external: true };
  }
  if (url && /^\/(wallpaper|collection|category)\//.test(url)) return { href: url.split("?")[0]!, external: false };
  return { href: "/notifications", external: false };
}

/** "now", "5m", "3h", "Yesterday", "4 Nov" */
export function timeAgo(iso: string, now = Date.now()) {
  const t = new Date(iso).getTime();
  const m = Math.floor((now - t) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  if (h < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Small label + colour per type. */
export function typeLabel(type: string): { label: string; color: string } {
  switch (type) {
    case "drop":
      return { label: "Drop", color: "#FFB66B" };
    case "daily":
      return { label: "Daily pick", color: "var(--accent)" };
    case "update":
    case "announcement":
      return { label: "Aurora", color: "#93C5FD" };
    case "admin_report":
    case "admin_application":
    case "admin_delivery":
      return { label: "Admin", color: "#F87171" };
    case "upload_live":
    case "upload_rejected":
    case "milestone":
      return { label: "Your uploads", color: "var(--text-muted)" };
    default:
      return { label: "Account", color: "var(--text-muted)" };
  }
}
