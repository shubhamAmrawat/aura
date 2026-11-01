// Website notifications (Web Push): the service worker in public/sw.js shows them; this file
// asks for permission, subscribes, and tells the API (linked to the account when signed in).

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const DISMISS_KEY = "aura_webpush_dismissed";

export type WebPushState = "unsupported" | "unavailable" | "denied" | "on" | "off";

export function webPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

let keyCache: string | null | undefined;
async function vapidKey(): Promise<string | null> {
  if (keyCache !== undefined) return keyCache;
  try {
    const res = await fetch(`${API_URL}/api/notifications/web/key`, { cache: "no-store" });
    const data = await res.json();
    keyCache = typeof data.key === "string" ? data.key : null;
  } catch {
    keyCache = null;
  }
  return keyCache ?? null;
}

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register(`/sw.js?api=${encodeURIComponent(API_URL ?? "")}`, { scope: "/" });
}

async function postSubscription(sub: PushSubscription) {
  await fetch(`${API_URL}/api/notifications/web/subscribe`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
}

export async function webPushState(): Promise<WebPushState> {
  if (!webPushSupported()) return "unsupported";
  if (!(await vapidKey())) return "unavailable";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** Ask the browser, subscribe, and register with the API. */
export async function enableWebPush(): Promise<boolean> {
  if (!webPushSupported()) return false;
  const key = await vapidKey();
  if (!key) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await postSubscription(sub);
  return true;
}

export async function disableWebPush() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch(`${API_URL}/api/notifications/web/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => undefined);
  await sub.unsubscribe();
}

/** Already on: re-send the subscription so it's linked to whoever is signed in now. */
export async function syncWebPush() {
  if (!webPushSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await postSubscription(sub).catch(() => undefined);
}

export function promptDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - t < 14 * 86_400_000;
  } catch {
    return false;
  }
}

export function dismissPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}
