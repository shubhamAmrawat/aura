import webpush from "web-push";
import { env } from "../config/env";

/**
 * Website notifications (Web Push, VAPID). Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
 * (generate once: `npx web-push generate-vapid-keys`) and VAPID_SUBJECT (mailto: or https: contact).
 */
let configured: boolean | null = null;

export function webPushEnabled() {
  if (configured === null) {
    configured = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    if (configured) webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:support@aurora-walls.com", env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  }
  return configured;
}

export const vapidPublicKey = () => (webPushEnabled() ? env.VAPID_PUBLIC_KEY! : null);

export type WebSubscription = { endpoint: string; p256dh: string; auth: string };

/** `dead` = the browser unsubscribed or the subscription expired (404/410). */
export async function sendWebPush(sub: WebSubscription, payload: unknown, ttlSeconds = 24 * 3600): Promise<{ ok: boolean; error?: string; dead?: boolean }> {
  if (!webPushEnabled()) return { ok: false, error: "Web push is not set up" };
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: ttlSeconds, urgency: "normal" });
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return { ok: false, error: `${status ?? ""} ${(e as Error).message ?? "send failed"}`.trim().slice(0, 200), dead: status === 404 || status === 410 };
  }
}
