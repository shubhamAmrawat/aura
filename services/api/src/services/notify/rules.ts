import { eq } from "drizzle-orm";
import { db } from "../../config/db";
import { siteSettings } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";

/**
 * Notification rules (admin › Notifications › Rules), kept in site_settings:
 *  quiet hours (IST) — non-urgent pushes wait until they end,
 *  daily cap — Aurora-wide pushes per phone/browser per IST day (extra ones: inbox only),
 *  automatic notifications on/off, and which admin alerts are sent.
 */
const KEY = "notifications.rules";

export const AUTO_KEYS = ["drop", "daily", "upload_live", "upload_rejected", "milestone", "creator", "report"] as const;
export type AutoKey = (typeof AUTO_KEYS)[number];
export const ALERT_KEYS = ["report", "application", "deliveryProblems"] as const;
export type AlertKey = (typeof ALERT_KEYS)[number];

export type NotificationRules = {
  quietStart: string; // "22:00" IST
  quietEnd: string; // "08:00" IST
  dailyCap: number;
  auto: Record<AutoKey, boolean>;
  alerts: Record<AlertKey, boolean>;
};

export const DEFAULT_RULES: NotificationRules = {
  quietStart: "22:00",
  quietEnd: "08:00",
  dailyCap: 2,
  auto: { drop: true, daily: true, upload_live: true, upload_rejected: true, milestone: true, creator: true, report: true },
  alerts: { report: true, application: true, deliveryProblems: false },
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

let cache: { at: number; rules: NotificationRules } | null = null;

export async function getRules(): Promise<NotificationRules> {
  if (cache && Date.now() - cache.at < 30_000) return cache.rules;
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, KEY)).limit(1);
  const v = (row?.value ?? {}) as Partial<NotificationRules>;
  const rules: NotificationRules = {
    quietStart: typeof v.quietStart === "string" && HHMM.test(v.quietStart) ? v.quietStart : DEFAULT_RULES.quietStart,
    quietEnd: typeof v.quietEnd === "string" && HHMM.test(v.quietEnd) ? v.quietEnd : DEFAULT_RULES.quietEnd,
    dailyCap: Number.isInteger(v.dailyCap) && v.dailyCap! >= 0 && v.dailyCap! <= 20 ? v.dailyCap! : DEFAULT_RULES.dailyCap,
    auto: { ...DEFAULT_RULES.auto, ...(v.auto ?? {}) },
    alerts: { ...DEFAULT_RULES.alerts, ...(v.alerts ?? {}) },
  };
  cache = { at: Date.now(), rules };
  return rules;
}

export async function setRules(adminId: string, input: NotificationRules) {
  if (!HHMM.test(input.quietStart) || !HHMM.test(input.quietEnd)) throw new ApiError(400, "Times look like 22:00");
  if (!Number.isInteger(input.dailyCap) || input.dailyCap < 0 || input.dailyCap > 20) throw new ApiError(400, "The daily cap is 0–20.");
  const value = {
    quietStart: input.quietStart,
    quietEnd: input.quietEnd,
    dailyCap: input.dailyCap,
    auto: Object.fromEntries(AUTO_KEYS.map((k) => [k, input.auto?.[k] ?? DEFAULT_RULES.auto[k]])),
    alerts: Object.fromEntries(ALERT_KEYS.map((k) => [k, input.alerts?.[k] ?? DEFAULT_RULES.alerts[k]])),
  };
  await db
    .insert(siteSettings)
    .values({ key: KEY, value, updatedAt: new Date(), updatedBy: adminId })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date(), updatedBy: adminId } });
  cache = null;
  await logAdminAction({ adminId, action: "notifications.rules", targetType: "settings", targetId: KEY, details: value });
  return getRules();
}

// ─── IST time helpers ───────────────────────────────────────

const IST_OFFSET_MIN = 330;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Minutes since midnight, India time. */
function istMinutes(d: Date) {
  return Math.floor(((d.getTime() / 60_000 + IST_OFFSET_MIN) % 1440 + 1440) % 1440);
}

export function isQuiet(rules: NotificationRules, now = new Date()) {
  const m = istMinutes(now);
  const s = toMin(rules.quietStart), e = toMin(rules.quietEnd);
  if (s === e) return false;
  return s < e ? m >= s && m < e : m >= s || m < e;
}

/** The next moment quiet hours end (UTC Date). */
export function quietEndsAt(rules: NotificationRules, now = new Date()) {
  const m = istMinutes(now);
  let delta = toMin(rules.quietEnd) - m;
  if (delta <= 0) delta += 1440;
  const at = new Date(now.getTime() + delta * 60_000);
  at.setUTCSeconds(0, 0);
  return at;
}

/** Midnight (start of today) in India, as a UTC Date. */
export function startOfIstDay(now = new Date()) {
  return new Date(now.getTime() - istMinutes(now) * 60_000 - (now.getUTCSeconds() * 1000 + now.getUTCMilliseconds()));
}
