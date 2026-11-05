import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { request } from "./api";
import type { ScreenFilter } from "./wallpaperApi";

/**
 * App notifications. Pushes from Aurora's API are drawn natively (modules/aurora-notify) with a
 * big picture and deep-link buttons; expo-notifications provides the permission prompt, the
 * Android channels and the Expo push token the API sends to.
 */

export type NotificationPrefs = { drops: boolean; daily: boolean; updates: boolean; uploads: boolean; milestones: boolean; account: boolean };
export const DEFAULT_PREFS: NotificationPrefs = { drops: true, daily: false, updates: true, uploads: true, milestones: true, account: true };

export type InboxItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  url: string | null;
  actions: { id: string; label: string; url: string }[];
  /** after this it's "Ended" (e.g. its drop ended) */
  expiresAt?: string | null;
  createdAt: string;
};

export const isEnded = (n: Pick<InboxItem, "expiresAt">, now = Date.now()) => !!n.expiresAt && new Date(n.expiresAt).getTime() <= now;

const TOKEN_KEY = "push_token_v1";
const SEEN_KEY = "notifications_seen_v1";
const ASK_KEY = "notifications_ask_v1";

/**
 * Android channels. Same ids as the API (CHANNEL in services/notify/engine.ts) and the native
 * module. HIGH = pops up on screen. A channel's importance can't be changed after it's created,
 * so a change means a new id (the old ones are deleted below).
 */
const CHANNELS: { id: string; name: string; importance: Notifications.AndroidImportance; description: string }[] = [
  { id: "drops_v2", name: "New drops", importance: Notifications.AndroidImportance.HIGH, description: "When a limited drop goes live" },
  { id: "uploads_v2", name: "Your uploads", importance: Notifications.AndroidImportance.HIGH, description: "Approved or needs changes" },
  { id: "account_v2", name: "Account and reports", importance: Notifications.AndroidImportance.HIGH, description: "Creator application, reports you made" },
  { id: "updates_v2", name: "App updates", importance: Notifications.AndroidImportance.HIGH, description: "When a new version is ready" },
  { id: "announcements", name: "Announcements", importance: Notifications.AndroidImportance.HIGH, description: "News and suggestions from Aurora" },
  { id: "milestones", name: "Milestones", importance: Notifications.AndroidImportance.DEFAULT, description: "When your wallpapers reach new likes" },
  { id: "daily", name: "Wallpaper of the day", importance: Notifications.AndroidImportance.DEFAULT, description: "Every morning at 9:00" },
];
/** Channels from 1.0.2–1.0.3 (didn't pop up), and "news" from 1.0.4 test builds. */
const OLD_CHANNELS = ["drops", "uploads", "account", "updates", "news"];

/** Fallback buttons, if a push is ever drawn by expo-notifications instead of the native module. */
const CATEGORIES: Record<string, { id: string; label: string }[]> = {
  drop: [{ id: "explore", label: "Explore" }, { id: "autochange", label: "Auto-change from it" }],
  daily: [{ id: "apply", label: "Set as wallpaper" }, { id: "save", label: "Save" }],
  upload_live: [{ id: "view", label: "View" }, { id: "apply", label: "Set as wallpaper" }],
  upload_rejected: [{ id: "why", label: "See why" }, { id: "reupload", label: "Upload again" }],
  update: [{ id: "update", label: "Update" }],
};

let configured = false;

/** Channels, categories and foreground display. Safe to call more than once. */
export async function configureNotifications() {
  if (configured || Platform.OS !== "android") return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  try {
    for (const c of CHANNELS) {
      await Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        importance: c.importance,
        description: c.description,
        lightColor: "#81EE4E",
        enableVibrate: true,
        showBadge: true,
      });
    }
    for (const id of OLD_CHANNELS) await Notifications.deleteNotificationChannelAsync(id).catch(() => undefined);
    for (const [id, actions] of Object.entries(CATEGORIES)) {
      await Notifications.setNotificationCategoryAsync(id, actions.map((a) => ({ identifier: a.id, buttonTitle: a.label, options: { opensAppToForeground: true } })));
    }
  } catch (e) {
    console.warn("[notifications] setup failed", e);
  }
}

export async function permissionState(): Promise<"granted" | "denied" | "undetermined"> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return "granted";
  return p.canAskAgain ? "undetermined" : "denied";
}

/** Android's own prompt (Android 13+); older versions are allowed by default. */
export async function requestPermission(): Promise<boolean> {
  await configureNotifications(); // a channel must exist before Android 13 shows the prompt
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

export async function getSavedPushToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Gets this phone's Expo push token and tells the API (linked to the account when signed in,
 * unlinked when signed out). Does nothing without permission.
 */
export async function registerForPush(screen: ScreenFilter): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  await configureNotifications();
  if ((await permissionState()) !== "granted") return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await request("/api/notifications/devices", {
    method: "POST",
    body: JSON.stringify({
      token,
      screen,
      platform: "android",
      appVersion: Constants.expoConfig?.version ?? null,
      deviceName: Constants.deviceName?.slice(0, 60) ?? null,
      osVersion: `Android ${Platform.Version}`,
    }),
  });
  await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => undefined);
  return token;
}

export async function getPrefs(): Promise<{ prefs: NotificationPrefs; registered: boolean }> {
  const token = await getSavedPushToken();
  if (!token) return { prefs: DEFAULT_PREFS, registered: false };
  return request(`/api/notifications/devices/prefs?token=${encodeURIComponent(token)}`);
}

export async function setPrefs(prefs: Partial<NotificationPrefs>): Promise<{ prefs: NotificationPrefs }> {
  const token = await getSavedPushToken();
  if (!token) throw new Error("Turn on notifications first.");
  return request("/api/notifications/devices/prefs", { method: "PUT", body: JSON.stringify({ token, prefs }) });
}

/** A notification (or one of its buttons) was tapped: counted in admin › Notifications › Campaigns. */
export async function reportOpened(deliveryId: string, action: string) {
  if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) return;
  await request("/api/notifications/opened", { method: "POST", body: JSON.stringify({ d: deliveryId, a: action.slice(0, 40) }) }).catch(() => undefined);
}

// ─── inbox ──────────────────────────────────────────────────

async function localSeen() {
  try {
    return await SecureStore.getItemAsync(SEEN_KEY);
  } catch {
    return null;
  }
}

function qs(params: Record<string, string | null | undefined>) {
  const q = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`);
  return q.length ? `?${q.join("&")}` : "";
}

export async function getUnread(screen: ScreenFilter, signedIn: boolean): Promise<number> {
  const res = await request<{ unread: number }>(`/api/notifications/unread${qs({ screen, since: signedIn ? null : await localSeen() })}`);
  return res.unread ?? 0;
}

export async function getInbox(screen: ScreenFilter, signedIn: boolean, before?: string) {
  return request<{ data: InboxItem[]; hasMore: boolean; seenAt: string; unread: number }>(
    `/api/notifications${qs({ screen, since: signedIn ? null : await localSeen(), before, limit: "30" })}`
  );
}

export async function markSeen(signedIn: boolean) {
  if (signedIn) {
    await request("/api/notifications/seen", { method: "POST" }).catch(() => undefined);
  } else {
    await SecureStore.setItemAsync(SEEN_KEY, new Date().toISOString()).catch(() => undefined);
  }
}

// ─── when to ask ────────────────────────────────────────────

type AskState = { count: number; last: number };
const ASK_GAP_MS = 7 * 86_400_000;
const ASK_MAX = 3;

/** Show our own explainer (then Android's prompt) after a good moment, at most 3 times, a week apart. */
export async function shouldAskForPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if ((await permissionState()) !== "undetermined") return false;
  let s: AskState = { count: 0, last: 0 };
  try {
    const raw = await SecureStore.getItemAsync(ASK_KEY);
    if (raw) s = JSON.parse(raw) as AskState;
  } catch {
    /* first time */
  }
  return s.count < ASK_MAX && Date.now() - s.last > ASK_GAP_MS;
}

export async function noteAsked() {
  let s: AskState = { count: 0, last: 0 };
  try {
    const raw = await SecureStore.getItemAsync(ASK_KEY);
    if (raw) s = JSON.parse(raw) as AskState;
  } catch {
    /* ignore */
  }
  await SecureStore.setItemAsync(ASK_KEY, JSON.stringify({ count: s.count + 1, last: Date.now() })).catch(() => undefined);
}

// ─── where a notification goes ──────────────────────────────

/** "now", "5m", "3h", "Yesterday", "4 Nov" */
export function timeAgo(iso: string, now = Date.now()) {
  const m = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  if (h < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function typeLabel(type: string): { label: string; color: string } {
  switch (type) {
    case "drop":
      return { label: "DROP", color: "#FFB66B" };
    case "daily":
      return { label: "DAILY PICK", color: "#81EE4E" };
    case "update":
    case "announcement":
      return { label: "AURORA", color: "#93C5FD" };
    case "upload_live":
    case "upload_rejected":
    case "milestone":
      return { label: "YOUR UPLOADS", color: "#A9A59F" };
    default:
      return { label: "ACCOUNT", color: "#A9A59F" };
  }
}
