import { env } from "../config/env";

/**
 * Expo Push Service (https://exp.host) — delivers to Android through Firebase Cloud Messaging
 * using the FCM credentials uploaded to EAS. Up to 100 messages per send, 1000 ids per receipt check.
 */
const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const CHUNK = 100;

export type ExpoMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Android notification channel (created by the app) */
  channelId?: string;
  /** notification category = which action buttons expo-notifications shows (fallback) */
  categoryId?: string;
  priority?: "default" | "normal" | "high";
  sound?: "default" | null;
  /** seconds; drops/daily picks are useless after a day */
  ttl?: number;
};

/** Per message, same order as sent. `dead` = the app was uninstalled or the token is invalid. */
export type ExpoResult = { ok: true; ticketId: string } | { ok: false; error: string; dead: boolean };

type Ticket = { status: "ok"; id: string } | { status: "error"; message: string; details?: { error?: string } };

const headers = () => ({
  Accept: "application/json",
  "Accept-Encoding": "gzip, deflate",
  "Content-Type": "application/json",
  ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
});

export async function sendExpoPush(messages: ExpoMessage[]): Promise<ExpoResult[]> {
  const results: ExpoResult[] = [];
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const res = await fetch(SEND_URL, { method: "POST", headers: headers(), body: JSON.stringify(chunk) });
      const json = (await res.json().catch(() => ({}))) as { data?: Ticket[]; errors?: { message?: string }[] };
      if (!res.ok || !Array.isArray(json.data)) {
        const msg = json.errors?.[0]?.message ?? `Expo send failed (${res.status})`;
        console.error("[push] Expo send failed:", res.status, msg);
        chunk.forEach(() => results.push({ ok: false, error: msg.slice(0, 200), dead: false }));
        continue;
      }
      chunk.forEach((_, j) => {
        const t = json.data![j];
        if (!t) results.push({ ok: false, error: "No ticket", dead: false });
        else if (t.status === "ok") results.push({ ok: true, ticketId: t.id });
        else results.push({ ok: false, error: (t.details?.error ?? t.message).slice(0, 200), dead: t.details?.error === "DeviceNotRegistered" });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      console.error("[push] Expo send error:", msg);
      chunk.forEach(() => results.push({ ok: false, error: msg.slice(0, 200), dead: false }));
    }
  }
  return results;
}

/** Receipts for tickets (available ~15 min after sending, kept 24 h). Missing ids = not ready yet. */
export async function getExpoReceipts(ids: string[]): Promise<Record<string, { ok: boolean; error?: string; dead?: boolean }>> {
  const out: Record<string, { ok: boolean; error?: string; dead?: boolean }> = {};
  for (let i = 0; i < ids.length; i += 1000) {
    try {
      const res = await fetch(RECEIPTS_URL, { method: "POST", headers: headers(), body: JSON.stringify({ ids: ids.slice(i, i + 1000) }) });
      const json = (await res.json().catch(() => ({}))) as { data?: Record<string, Ticket> };
      for (const [id, r] of Object.entries(json.data ?? {})) {
        out[id] = r.status === "ok" ? { ok: true } : { ok: false, error: (r.details?.error ?? r.message).slice(0, 200), dead: r.details?.error === "DeviceNotRegistered" };
      }
    } catch (e) {
      console.error("[push] receipts error:", e instanceof Error ? e.message : e);
    }
  }
  return out;
}

/** Looks like an Expo push token. */
export const isExpoPushToken = (t: string) => /^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{10,}\]$/.test(t);
