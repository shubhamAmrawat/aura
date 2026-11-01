import { and, desc, eq, gt, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../config/db";
import { notifications, notificationSeen, pushDevices, type NotificationAction, type NotificationPrefs } from "../models";
import { sendExpoPush, type ExpoMessage } from "../integrations/expoPush";
import type { ScreenFilter } from "../utils/screenFilter";

/**
 * Notifications: an inbox row per event (personal or broadcast) and an app push to the phones
 * that want that type. Every send is best-effort: a failed push never fails the action that
 * caused it, and dedupeKey makes sure one event is only ever sent once.
 */

export type NotificationType =
  | "drop"
  | "daily"
  | "update"
  | "announcement"
  | "upload_live"
  | "upload_rejected"
  | "milestone"
  | "creator_approved"
  | "creator_rejected"
  | "report_reviewed";

type PrefKey = keyof NotificationPrefs;

const PREF: Record<NotificationType, PrefKey> = {
  drop: "drops",
  daily: "daily",
  update: "updates",
  announcement: "updates",
  upload_live: "uploads",
  upload_rejected: "uploads",
  milestone: "milestones",
  creator_approved: "account",
  creator_rejected: "account",
  report_reviewed: "account",
};

/** Off unless the user turns it on: the daily pick. Everything else is on by default. */
export const PREF_DEFAULTS: Required<NotificationPrefs> = { drops: true, daily: false, updates: true, uploads: true, milestones: true, account: true };

/** Android channel per type (the app creates these channels with the same ids). */
const CHANNEL: Record<NotificationType, string> = {
  drop: "drops",
  daily: "daily",
  update: "updates",
  announcement: "updates",
  upload_live: "uploads",
  upload_rejected: "uploads",
  milestone: "uploads",
  creator_approved: "account",
  creator_rejected: "account",
  report_reviewed: "account",
};

/** Push lifetime: stale drops / daily picks shouldn't arrive days later. */
const TTL: Partial<Record<NotificationType, number>> = { drop: 24 * 3600, daily: 12 * 3600 };

export type NewNotification = {
  type: NotificationType;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  /** path (same on app and website), https link, or null = open the inbox */
  url?: string | null;
  /** button ids must match the app's category for this type */
  actions?: NotificationAction[];
  dedupeKey?: string;
  /** broadcasts: only phones of this shape */
  screen?: ScreenFilter | null;
};

async function insertRow(userId: string | null, n: NewNotification) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      imageUrl: n.imageUrl ?? null,
      url: n.url ?? null,
      actions: n.actions ?? [],
      screen: n.screen ?? null,
      dedupeKey: n.dedupeKey ?? null,
    })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning();
  return row ?? null; // null = this event was already sent
}

const prefOn = (type: NotificationType) => {
  const key = PREF[type];
  return sql`coalesce((${pushDevices.prefs} ->> ${key})::boolean, ${PREF_DEFAULTS[key]})`;
};

async function pushRow(row: typeof notifications.$inferSelect, audience: SQL | undefined) {
  const type = row.type as NotificationType;
  const devices = await db
    .select({ token: pushDevices.token })
    .from(pushDevices)
    .where(and(isNull(pushDevices.disabledAt), prefOn(type), audience));
  if (!devices.length) return;

  const actions = row.actions ?? [];
  const image = row.imageUrl && /^https:\/\//.test(row.imageUrl) ? row.imageUrl : null;
  // `rich`: the app's native module draws it (big picture + these buttons, each a deep link).
  // Kept as a data-only push (no richContent), so Android never shows it without the buttons.
  const data = {
    rich: true,
    nid: row.id,
    type,
    url: row.url,
    image,
    buttons: actions.map((a) => ({ id: a.id, label: a.label, url: a.url })),
    actions: Object.fromEntries(actions.map((a) => [a.id, a.url])),
  };
  const messages: ExpoMessage[] = devices.map((d) => ({
    to: d.token,
    title: row.title,
    ...(row.body ? { body: row.body } : {}),
    data,
    channelId: CHANNEL[type],
    ...(actions.length ? { categoryId: type } : {}),
    priority: "high",
    sound: "default",
    ...(TTL[type] ? { ttl: TTL[type] } : {}),
  }));

  const { sent, deadTokens } = await sendExpoPush(messages);
  if (deadTokens.length) {
    await db.update(pushDevices).set({ disabledAt: new Date() }).where(inArray(pushDevices.token, deadTokens));
  }
  await db.update(notifications).set({ pushed: sent }).where(eq(notifications.id, row.id));
}

/** A personal notification: inbox row + push to the user's phones. Never throws. */
export async function notifyUser(userId: string, n: NewNotification) {
  try {
    const row = await insertRow(userId, n);
    if (row) await pushRow(row, eq(pushDevices.userId, userId));
  } catch (e) {
    console.error(`[notify] ${n.type} for user failed:`, e instanceof Error ? e.message : e);
  }
}

/** A broadcast: one inbox row everyone sees + push to every phone that wants it. Never throws. */
export async function broadcast(n: NewNotification) {
  try {
    const row = await insertRow(null, n);
    if (!row) return null;
    await pushRow(row, n.screen ? eq(pushDevices.screen, n.screen) : undefined);
    const [after] = await db.select({ pushed: notifications.pushed }).from(notifications).where(eq(notifications.id, row.id));
    return { id: row.id, pushed: after?.pushed ?? 0 };
  } catch (e) {
    console.error(`[notify] broadcast ${n.type} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Was this event already sent? */
export async function alreadySent(dedupeKey: string) {
  const [row] = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.dedupeKey, dedupeKey)).limit(1);
  return !!row;
}

// ─── devices ────────────────────────────────────────────────

export async function registerDevice(input: { token: string; userId: string | null; screen: ScreenFilter; platform: string; appVersion: string | null }) {
  const now = new Date();
  await db
    .insert(pushDevices)
    .values({ token: input.token, userId: input.userId, screen: input.screen, platform: input.platform, appVersion: input.appVersion })
    .onConflictDoUpdate({
      target: pushDevices.token,
      set: { userId: input.userId, screen: input.screen, platform: input.platform, appVersion: input.appVersion, lastSeenAt: now, disabledAt: null },
    });
  return getDevicePrefs(input.token);
}

export async function getDevicePrefs(token: string) {
  const [row] = await db.select({ prefs: pushDevices.prefs }).from(pushDevices).where(eq(pushDevices.token, token)).limit(1);
  return { prefs: { ...PREF_DEFAULTS, ...(row?.prefs ?? {}) }, registered: !!row };
}

export async function setDevicePrefs(token: string, prefs: NotificationPrefs) {
  const [row] = await db
    .update(pushDevices)
    .set({ prefs: sql`${pushDevices.prefs} || ${JSON.stringify(prefs)}::jsonb` })
    .where(eq(pushDevices.token, token))
    .returning({ prefs: pushDevices.prefs });
  return { prefs: { ...PREF_DEFAULTS, ...(row?.prefs ?? prefs) }, registered: !!row };
}

/** The phone signed out or turned notifications off in Android: stop pushing to it. */
export async function disableDevice(token: string) {
  await db.update(pushDevices).set({ disabledAt: new Date() }).where(eq(pushDevices.token, token));
}

// ─── inbox ──────────────────────────────────────────────────

const BROADCAST_DAYS = 30;
/** With nothing seen yet, only the last week counts as unread. */
const DEFAULT_UNSEEN_DAYS = 7;

function inboxWhere(userId: string | undefined, screen: ScreenFilter | null) {
  const since = new Date(Date.now() - BROADCAST_DAYS * 86_400_000);
  const broadcasts = and(
    isNull(notifications.userId),
    gt(notifications.createdAt, since),
    screen ? or(isNull(notifications.screen), eq(notifications.screen, screen)) : undefined
  );
  return userId ? or(eq(notifications.userId, userId), broadcasts)! : broadcasts!;
}

async function seenAt(userId: string | undefined, since: Date | null) {
  if (userId) {
    const [row] = await db.select({ seenAt: notificationSeen.seenAt }).from(notificationSeen).where(eq(notificationSeen.userId, userId)).limit(1);
    if (row) return row.seenAt;
  } else if (since) {
    return since;
  }
  return new Date(Date.now() - DEFAULT_UNSEEN_DAYS * 86_400_000);
}

async function countUnread(where: SQL, seen: Date) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(where, gt(notifications.createdAt, seen)));
  return Math.min(row?.n ?? 0, 99);
}

/** Inbox page: the user's own notifications plus recent broadcasts, newest first. */
export async function listInbox(opts: { userId?: string; screen: ScreenFilter | null; since: Date | null; before: Date | null; limit: number }) {
  const where = inboxWhere(opts.userId, opts.screen);
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      imageUrl: notifications.imageUrl,
      url: notifications.url,
      actions: notifications.actions,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(where, opts.before ? lt(notifications.createdAt, opts.before) : undefined))
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit + 1);
  const seen = await seenAt(opts.userId, opts.since);
  return {
    data: rows.slice(0, opts.limit),
    hasMore: rows.length > opts.limit,
    seenAt: seen,
    unread: await countUnread(where, seen),
  };
}

export async function unreadCount(opts: { userId?: string; screen: ScreenFilter | null; since: Date | null }) {
  const where = inboxWhere(opts.userId, opts.screen);
  return { unread: await countUnread(where, await seenAt(opts.userId, opts.since)) };
}

/** Opening the inbox: everything up to now counts as seen. */
export async function markSeen(userId: string) {
  const now = new Date();
  await db.insert(notificationSeen).values({ userId, seenAt: now }).onConflictDoUpdate({ target: notificationSeen.userId, set: { seenAt: now } });
  return { seenAt: now };
}

/** Admin: how many phones can get push, and per type how many want it. */
export async function deviceStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*) filter (where ${pushDevices.disabledAt} is null)::int`,
      signedIn: sql<number>`count(*) filter (where ${pushDevices.disabledAt} is null and ${pushDevices.userId} is not null)::int`,
      daily: sql<number>`count(*) filter (where ${pushDevices.disabledAt} is null and ${prefOn("daily")})::int`,
      drops: sql<number>`count(*) filter (where ${pushDevices.disabledAt} is null and ${prefOn("drop")})::int`,
      updates: sql<number>`count(*) filter (where ${pushDevices.disabledAt} is null and ${prefOn("update")})::int`,
    })
    .from(pushDevices);
  return row ?? { total: 0, signedIn: 0, daily: 0, drops: 0, updates: 0 };
}

export async function recentBroadcasts(limit = 20) {
  return db
    .select({ id: notifications.id, type: notifications.type, title: notifications.title, body: notifications.body, pushed: notifications.pushed, createdAt: notifications.createdAt })
    .from(notifications)
    .where(isNull(notifications.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
