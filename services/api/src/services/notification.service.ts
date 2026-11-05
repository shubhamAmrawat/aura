import { and, desc, eq, gt, isNull, like, lt, notLike, or, sql, type SQL } from "drizzle-orm";
import { db } from "../config/db";
import { notifications, notificationSeen, pushDevices, webPushSubscriptions, type NotificationPrefs } from "../models";
import { PREF_DEFAULTS } from "./notify/engine";
import type { ScreenFilter } from "../utils/screenFilter";

/**
 * Notifications: phones and browsers (with their switches), and the inbox. Sending lives in
 * notify/engine.ts.
 */

// ─── devices ────────────────────────────────────────────────

export async function registerDevice(input: {
  token: string;
  userId: string | null;
  screen: ScreenFilter;
  platform: string;
  appVersion: string | null;
  deviceName: string | null;
  osVersion: string | null;
}) {
  const now = new Date();
  const fields = {
    userId: input.userId,
    screen: input.screen,
    platform: input.platform,
    appVersion: input.appVersion,
    deviceName: input.deviceName,
    osVersion: input.osVersion,
  };
  await db
    .insert(pushDevices)
    .values({ token: input.token, ...fields })
    .onConflictDoUpdate({ target: pushDevices.token, set: { ...fields, lastSeenAt: now, disabledAt: null } });
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

export type InboxScope = "all" | "user" | "admin";

/** Ended items stay in the inbox (marked "Ended") this long, then drop out. */
const ENDED_KEEP_DAYS = 3;

function inboxWhere(userId: string | undefined, screen: ScreenFilter | null, scope: InboxScope = "all") {
  const keep = or(isNull(notifications.expiresAt), gt(notifications.expiresAt, new Date(Date.now() - ENDED_KEEP_DAYS * 86_400_000)))!;
  return and(inboxWhereScoped(userId, screen, scope), keep)!;
}

function inboxWhereScoped(userId: string | undefined, screen: ScreenFilter | null, scope: InboxScope) {
  // admin alerts (types admin_*) are always personal rows
  if (scope === "admin") return userId ? and(eq(notifications.userId, userId), like(notifications.type, "admin\\_%"))! : sql`false`;
  const all = inboxWhereAll(userId, screen);
  return scope === "user" ? and(all, notLike(notifications.type, "admin\\_%"))! : all;
}

function inboxWhereAll(userId: string | undefined, screen: ScreenFilter | null) {
  const since = new Date(Date.now() - BROADCAST_DAYS * 86_400_000);
  const broadcasts = and(
    isNull(notifications.userId),
    gt(notifications.createdAt, since),
    screen ? or(isNull(notifications.screen), eq(notifications.screen, screen)) : undefined
  );
  return userId ? or(eq(notifications.userId, userId), broadcasts)! : broadcasts!;
}

async function seenAt(userId: string | undefined, since: Date | null, admin = false) {
  if (userId) {
    const [row] = await db.select({ seenAt: notificationSeen.seenAt, adminSeenAt: notificationSeen.adminSeenAt }).from(notificationSeen).where(eq(notificationSeen.userId, userId)).limit(1);
    if (row && (!admin || row.adminSeenAt)) return admin ? row.adminSeenAt! : row.seenAt;
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
export async function listInbox(opts: { userId?: string; screen: ScreenFilter | null; since: Date | null; before: Date | null; limit: number; scope?: InboxScope }) {
  const where = inboxWhere(opts.userId, opts.screen, opts.scope);
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      imageUrl: notifications.imageUrl,
      url: notifications.url,
      actions: notifications.actions,
      expiresAt: notifications.expiresAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(where, opts.before ? lt(notifications.createdAt, opts.before) : undefined))
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit + 1);
  const seen = await seenAt(opts.userId, opts.since, opts.scope === "admin");
  return {
    data: rows.slice(0, opts.limit),
    hasMore: rows.length > opts.limit,
    seenAt: seen,
    unread: await countUnread(where, seen),
  };
}

export async function unreadCount(opts: { userId?: string; screen: ScreenFilter | null; since: Date | null; scope?: InboxScope }) {
  const where = inboxWhere(opts.userId, opts.screen, opts.scope);
  return { unread: await countUnread(where, await seenAt(opts.userId, opts.since, opts.scope === "admin")) };
}

/** Opening the inbox (or, with admin, the admin bell): everything up to now counts as seen. */
export async function markSeen(userId: string, admin = false) {
  const now = new Date();
  if (admin) {
    // first time: leave the regular inbox's "seen" where the default would have put it
    await db
      .insert(notificationSeen)
      .values({ userId, seenAt: new Date(Date.now() - DEFAULT_UNSEEN_DAYS * 86_400_000), adminSeenAt: now })
      .onConflictDoUpdate({ target: notificationSeen.userId, set: { adminSeenAt: now } });
  } else {
    await db.insert(notificationSeen).values({ userId, seenAt: now }).onConflictDoUpdate({ target: notificationSeen.userId, set: { seenAt: now } });
  }
  return { seenAt: now };
}

/** Admin: how many phones and browsers can get push, and how many want each Aurora-wide type. */
export async function deviceStats() {
  const on = (col: typeof pushDevices.prefs, key: keyof NotificationPrefs) => sql`coalesce((${col} ->> ${key})::boolean, ${PREF_DEFAULTS[key]})`;
  const [app] = await db
    .select({
      total: sql<number>`count(*)::int`,
      signedIn: sql<number>`count(*) filter (where ${pushDevices.userId} is not null)::int`,
      daily: sql<number>`count(*) filter (where ${on(pushDevices.prefs, "daily")})::int`,
      drops: sql<number>`count(*) filter (where ${on(pushDevices.prefs, "drops")})::int`,
      updates: sql<number>`count(*) filter (where ${on(pushDevices.prefs, "updates")})::int`,
    })
    .from(pushDevices)
    .where(isNull(pushDevices.disabledAt));
  const [web] = await db.select({ total: sql<number>`count(*)::int` }).from(webPushSubscriptions).where(isNull(webPushSubscriptions.disabledAt));
  return { ...(app ?? { total: 0, signedIn: 0, daily: 0, drops: 0, updates: 0 }), browsers: web?.total ?? 0 };
}

// ─── website (Web Push) subscriptions ───────────────────────

export async function subscribeWeb(input: { endpoint: string; p256dh: string; auth: string; userId: string | null; userAgent: string | null }) {
  const now = new Date();
  const fields = { p256dh: input.p256dh, auth: input.auth, userId: input.userId, userAgent: input.userAgent };
  await db
    .insert(webPushSubscriptions)
    .values({ endpoint: input.endpoint, ...fields })
    .onConflictDoUpdate({ target: webPushSubscriptions.endpoint, set: { ...fields, lastSeenAt: now, disabledAt: null } });
  return { ok: true };
}

export async function unsubscribeWeb(endpoint: string) {
  await db.update(webPushSubscriptions).set({ disabledAt: new Date() }).where(eq(webPushSubscriptions.endpoint, endpoint));
  return { ok: true };
}

export async function setWebPrefs(endpoint: string, prefs: NotificationPrefs) {
  await db
    .update(webPushSubscriptions)
    .set({ prefs: sql`${webPushSubscriptions.prefs} || ${JSON.stringify(prefs)}::jsonb` })
    .where(eq(webPushSubscriptions.endpoint, endpoint));
  return { ok: true };
}
