import { env } from "../config/env";

/**
 * Expo Push Service (https://exp.host) — delivers to Android through Firebase Cloud Messaging
 * using the FCM credentials uploaded to EAS. Up to 100 messages per request.
 */
const SEND_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100;

export type ExpoMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Android notification channel (created by the app) */
  channelId?: string;
  /** notification category = which action buttons the app shows */
  categoryId?: string;
  priority?: "default" | "normal" | "high";
  sound?: "default" | null;
  /** seconds; drops/daily picks are useless after a day */
  ttl?: number;
};

type Ticket = { status: "ok"; id: string } | { status: "error"; message: string; details?: { error?: string } };

/** Sends the messages; returns the tokens Expo says are no longer valid (uninstalled, etc.). */
export async function sendExpoPush(messages: ExpoMessage[]): Promise<{ sent: number; deadTokens: string[] }> {
  let sent = 0;
  const deadTokens: string[] = [];
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const res = await fetch(SEND_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: Ticket[]; errors?: unknown };
      if (!res.ok || !Array.isArray(json.data)) {
        console.error("[push] Expo send failed:", res.status, JSON.stringify(json.errors ?? json).slice(0, 300));
        continue;
      }
      json.data.forEach((t, j) => {
        if (t.status === "ok") sent++;
        else if (t.details?.error === "DeviceNotRegistered") deadTokens.push(chunk[j]!.to);
        else console.warn("[push] ticket error:", t.message);
      });
    } catch (e) {
      console.error("[push] Expo send error:", e instanceof Error ? e.message : e);
    }
  }
  return { sent, deadTokens };
}

/** Looks like an Expo push token. */
export const isExpoPushToken = (t: string) => /^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{10,}\]$/.test(t);
