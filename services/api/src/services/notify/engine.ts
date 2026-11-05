import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/db";
import {
  downloads,
  likes,
  wallpapers,
  notificationCampaigns,
  notificationDeliveries,
  notifications,
  pushDevices,
  users,
  webPushSubscriptions,
  type CampaignAudience,
  type NotificationAction,
  type NotificationPrefs,
} from "../../models";
import { getExpoReceipts, sendExpoPush, type ExpoMessage } from "../../integrations/expoPush";
import { sendWebPush, webPushEnabled } from "../../integrations/webPush";
import { getRules, isQuiet, quietEndsAt, startOfIstDay } from "./rules";

/**
 * The notification engine. Every send is a campaign:
 *   createCampaign → (scheduled / held for quiet hours) → materialize: resolve the audience into
 *   delivery rows (one per phone / browser) + inbox rows → processQueue: push them (Expo / Web Push),
 *   respecting the daily cap → checkReceipts: Expo receipts mark delivered / failed → markOpened.
 * Runs inline after a send and from the scheduler tick (jobs/trending.job.ts + the GitHub cron).
 */

export type NotificationType =
  | "drop" | "daily" | "update" | "announcement"
  | "upload_live" | "upload_rejected" | "milestone"
  | "creator_approved" | "creator_rejected" | "report_reviewed"
  | "admin_report" | "admin_application" | "admin_delivery" | "admin_signup";

type PrefKey = keyof NotificationPrefs;

export const PREF: Record<NotificationType, PrefKey> = {
  drop: "drops", daily: "daily", update: "updates", announcement: "updates",
  upload_live: "uploads", upload_rejected: "uploads", milestone: "milestones",
  creator_approved: "account", creator_rejected: "account", report_reviewed: "account",
  admin_report: "account", admin_application: "account", admin_delivery: "account", admin_signup: "account",
};

export const PREF_DEFAULTS: Required<NotificationPrefs> = { drops: true, daily: false, updates: true, uploads: true, milestones: true, account: true };

/** Android channels (app 1.0.4+): *_v2 and announcements pop up on screen; milestones and daily stay quiet. */
const CHANNEL: Record<NotificationType, string> = {
  drop: "drops_v2", daily: "daily", update: "updates_v2", announcement: "announcements",
  upload_live: "uploads_v2", upload_rejected: "uploads_v2", milestone: "milestones",
  creator_approved: "account_v2", creator_rejected: "account_v2", report_reviewed: "account_v2",
  admin_report: "account_v2", admin_application: "account_v2", admin_delivery: "account_v2", admin_signup: "account_v2",
};
/** Apps before 1.0.4 only have the old channels. */
const LEGACY_CHANNEL: Record<NotificationType, string> = {
  drop: "drops", daily: "daily", update: "updates", announcement: "updates",
  upload_live: "uploads", upload_rejected: "uploads", milestone: "uploads",
  creator_approved: "account", creator_rejected: "account", report_reviewed: "account",
  admin_report: "account", admin_application: "account", admin_delivery: "account", admin_signup: "account",
};
const channelFor = (type: NotificationType, appVersion: string | null) =>
  (older(appVersion, "1.0.4") ? LEGACY_CHANNEL : CHANNEL)[type] ?? "updates";

/** Go out straight away, even in quiet hours, and never count toward the cap. */
const URGENT = new Set<NotificationType>(["upload_live", "upload_rejected", "creator_approved", "creator_rejected", "report_reviewed", "admin_report", "admin_application", "admin_delivery"]);
/** Count toward the daily cap (Aurora-wide messages). */
const CAPPED = new Set<NotificationType>(["drop", "daily", "announcement", "update"]);

const TTL: Partial<Record<NotificationType, number>> = { drop: 24 * 3600, daily: 12 * 3600 };

export type NewCampaign = {
  kind: "manual" | "auto" | "test";
  type: NotificationType;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  /** path (same on app and website), https link, or null = the inbox */
  url?: string | null;
  actions?: NotificationAction[];
  audience: CampaignAudience;
  /** null/omitted = now */
  scheduledFor?: Date | null;
  respectQuiet?: boolean;
  dedupeKey?: string;
  createdBy?: string | null;
  /** made from this template: skip people who got it in the last cooldownDays */
  templateId?: string | null;
  cooldownDays?: number;
  /** not pushed after this (e.g. when the drop it's about ends); inbox items show "Ended" */
  expiresAt?: Date | null;
};

type Campaign = typeof notificationCampaigns.$inferSelect;

/** Create a campaign; due ones are sent right away (in the background). null = already sent (dedupe). */
export async function createCampaign(input: NewCampaign, opts: { wait?: boolean } = {}) {
  const [row] = await db
    .insert(notificationCampaigns)
    .values({
      kind: input.kind,
      type: input.type,
      title: input.title.slice(0, 120),
      body: input.body?.slice(0, 400) ?? null,
      imageUrl: input.imageUrl ?? null,
      url: input.url ?? null,
      actions: (input.actions ?? []).slice(0, 2),
      audience: input.audience,
      respectQuiet: input.respectQuiet ?? !URGENT.has(input.type),
      status: "scheduled",
      scheduledFor: input.scheduledFor ?? new Date(),
      dedupeKey: input.dedupeKey ?? null,
      createdBy: input.createdBy ?? null,
      templateId: input.templateId ?? null,
      cooldownDays: input.cooldownDays ?? 0,
      expiresAt: input.expiresAt ?? null,
    })
    .onConflictDoNothing({ target: notificationCampaigns.dedupeKey })
    .returning();
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    await db.update(notificationCampaigns).set({ status: "cancelled", finishedAt: new Date() }).where(eq(notificationCampaigns.id, row.id));
    return { ...row, status: "cancelled" as const };
  }
  if (row.scheduledFor.getTime() <= Date.now() + 1000) {
    const run = startCampaign(row).catch((e) => console.error("[notify] campaign failed:", e instanceof Error ? e.message : e));
    if (opts.wait) await run;
  }
  return row;
}

/** Was this event already sent (by the engine, or by the old notifications table)? */
export async function alreadySent(dedupeKey: string) {
  const [a] = await db.select({ id: notificationCampaigns.id }).from(notificationCampaigns).where(eq(notificationCampaigns.dedupeKey, dedupeKey)).limit(1);
  if (a) return true;
  const [b] = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.dedupeKey, dedupeKey)).limit(1);
  return !!b;
}

// ─── audience ───────────────────────────────────────────────

type Target = { channel: "app" | "web"; target: string; userId: string | null; p256dh?: string; auth?: string };

const older = (v: string | null, than: string) => {
  if (!v) return true;
  const a = v.split(".").map(Number), b = than.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
};

function userFilter(col: typeof pushDevices.userId | typeof webPushSubscriptions.userId, a: CampaignAudience): SQL | undefined {
  switch (a.kind) {
    case "signedIn": return isNotNull(col);
    case "signedOut": return isNull(col);
    case "creators": return inArray(col, db.select({ id: users.id }).from(users).where(eq(users.isCreator, true)));
    case "admins": return inArray(col, db.select({ id: users.id }).from(users).where(eq(users.role, "admin")));
    case "users": return a.userIds?.length ? inArray(col, a.userIds) : sql`false`;
    default: return undefined;
  }
}

/** Phones and browsers this audience reaches (respecting each one's switches unless `ignorePrefs`). */
export async function resolveAudience(a: CampaignAudience, type: NotificationType, ignorePrefs: boolean): Promise<Target[]> {
  const key = PREF[type];
  const prefOn = (col: typeof pushDevices.prefs | typeof webPushSubscriptions.prefs) => sql`coalesce((${col} ->> ${key})::boolean, ${PREF_DEFAULTS[key]})`;
  const out: Target[] = [];

  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const creatorIds = () => db.select({ id: users.id }).from(users).where(eq(users.isCreator, true));
  const appRows = await db
    .select({ token: pushDevices.token, userId: pushDevices.userId, appVersion: pushDevices.appVersion })
    .from(pushDevices)
    .where(
      and(
        isNull(pushDevices.disabledAt),
        a.installedDays ? lt(pushDevices.createdAt, daysAgo(a.installedDays)) : undefined,
        a.excludeCreators ? or(isNull(pushDevices.userId), notInArray(pushDevices.userId, creatorIds())) : undefined,
        ignorePrefs ? undefined : prefOn(pushDevices.prefs),
        a.kind === "devices" ? (a.targets?.length ? inArray(pushDevices.token, a.targets) : sql`false`) : userFilter(pushDevices.userId, a),
        a.screen ? eq(pushDevices.screen, a.screen) : undefined,
        a.activeDays ? (a.activeDays > 0 ? gt(pushDevices.lastSeenAt, new Date(Date.now() - a.activeDays * 86_400_000)) : lt(pushDevices.lastSeenAt, new Date(Date.now() + a.activeDays * 86_400_000))) : undefined
      )
    );
  for (const r of appRows) if (!a.versionBelow || older(r.appVersion, a.versionBelow)) out.push({ channel: "app", target: r.token, userId: r.userId });

  const wantWeb = webPushEnabled() && !a.versionBelow && !a.screen && (a.includeWeb || a.kind === "users" || a.kind === "admins" || a.kind === "devices");
  if (wantWeb) {
    const webRows = await db
      .select({ endpoint: webPushSubscriptions.endpoint, userId: webPushSubscriptions.userId, p256dh: webPushSubscriptions.p256dh, auth: webPushSubscriptions.auth })
      .from(webPushSubscriptions)
      .where(
        and(
          isNull(webPushSubscriptions.disabledAt),
          a.installedDays ? lt(webPushSubscriptions.createdAt, daysAgo(a.installedDays)) : undefined,
          a.excludeCreators ? or(isNull(webPushSubscriptions.userId), notInArray(webPushSubscriptions.userId, creatorIds())) : undefined,
          ignorePrefs ? undefined : prefOn(webPushSubscriptions.prefs),
          a.kind === "devices" ? (a.targets?.length ? inArray(webPushSubscriptions.endpoint, a.targets) : sql`false`) : userFilter(webPushSubscriptions.userId, a),
          a.activeDays ? (a.activeDays > 0 ? gt(webPushSubscriptions.lastSeenAt, new Date(Date.now() - a.activeDays * 86_400_000)) : lt(webPushSubscriptions.lastSeenAt, new Date(Date.now() + a.activeDays * 86_400_000))) : undefined
        )
      );
    for (const r of webRows) out.push({ channel: "web", target: r.endpoint, userId: r.userId, p256dh: r.p256dh, auth: r.auth });
  }
  if (a.notOpenedLatestDrop && out.length) {
    const [latest] = await db
      .select({ id: notificationCampaigns.id })
      .from(notificationCampaigns)
      .where(and(eq(notificationCampaigns.type, "drop"), ne(notificationCampaigns.kind, "test"), inArray(notificationCampaigns.status, ["sending", "sent"])))
      .orderBy(desc(notificationCampaigns.startedAt))
      .limit(1);
    if (latest) {
      const opened = await db
        .select({ target: notificationDeliveries.target })
        .from(notificationDeliveries)
        .where(and(eq(notificationDeliveries.campaignId, latest.id), isNotNull(notificationDeliveries.openedAt)));
      const skip = new Set(opened.map((r) => r.target));
      return out.filter((t) => !skip.has(t.target));
    }
  }
  return out;
}

/** Template cooldown: leave out phones / browsers / people that got this template in the last `days` days. */
export async function applyCooldown<T extends { target: string; userId: string | null }>(targets: T[], templateId: string | null, days: number, exceptCampaign?: string): Promise<T[]> {
  if (!templateId || days <= 0 || !targets.length) return targets;
  const rows = await db
    .select({ target: notificationDeliveries.target, userId: notificationDeliveries.userId })
    .from(notificationDeliveries)
    .innerJoin(notificationCampaigns, eq(notificationCampaigns.id, notificationDeliveries.campaignId))
    .where(
      and(
        eq(notificationCampaigns.templateId, templateId),
        ne(notificationCampaigns.kind, "test"),
        exceptCampaign ? ne(notificationCampaigns.id, exceptCampaign) : undefined,
        gt(notificationDeliveries.createdAt, new Date(Date.now() - days * 86_400_000)),
        inArray(notificationDeliveries.status, ["queued", "sent", "delivered"])
      )
    );
  const t = new Set(rows.map((r) => r.target));
  const u = new Set(rows.flatMap((r) => (r.userId ? [r.userId] : [])));
  return targets.filter((x) => !t.has(x.target) && !(x.userId && u.has(x.userId)));
}

/** Admin sends to specific people or phones are direct messages: they skip the person's switches. */
const isDirect = (c: { kind: string; audience: CampaignAudience }) => c.kind === "test" || (c.kind === "manual" && (c.audience.kind === "users" || c.audience.kind === "devices"));

// ─── sending ────────────────────────────────────────────────

/** Due now: hold for quiet hours, or resolve the audience and send. */
async function startCampaign(c: Campaign) {
  const type = c.type as NotificationType;
  // e.g. held through quiet hours past the end of its drop: don't send it at all
  if (c.expiresAt && c.expiresAt.getTime() <= Date.now()) {
    await db
      .update(notificationCampaigns)
      .set({ status: "cancelled", finishedAt: new Date() })
      .where(and(eq(notificationCampaigns.id, c.id), inArray(notificationCampaigns.status, ["scheduled", "held"])));
    return;
  }
  const rules = await getRules();
  if (c.respectQuiet && !URGENT.has(type) && c.kind !== "test" && isQuiet(rules)) {
    await db
      .update(notificationCampaigns)
      .set({ status: "held", scheduledFor: quietEndsAt(rules) })
      .where(and(eq(notificationCampaigns.id, c.id), inArray(notificationCampaigns.status, ["scheduled", "held"])));
    return;
  }
  // claim it (the scheduler may be looking at the same campaign)
  const [claimed] = await db
    .update(notificationCampaigns)
    .set({ status: "sending", startedAt: new Date() })
    .where(and(eq(notificationCampaigns.id, c.id), inArray(notificationCampaigns.status, ["scheduled", "held"])))
    .returning();
  if (!claimed) return;

  const targets = await applyCooldown(await resolveAudience(c.audience, type, isDirect(c)), c.templateId, c.cooldownDays, c.id);
  for (let i = 0; i < targets.length; i += 1000) {
    await db.insert(notificationDeliveries).values(
      targets.slice(i, i + 1000).map((t) => ({ campaignId: c.id, channel: t.channel, target: t.target, userId: t.userId }))
    );
  }
  await writeInbox(c, targets);
  await processQueue(c.id);
  await refreshCounts([c.id]);
}

/** Inbox rows: one shared row for "everyone"; otherwise one per person reached (tests: none). */
async function writeInbox(c: Campaign, targets: Target[]) {
  if (c.kind === "test") return;
  const base = { type: c.type, title: personalize(c.title), body: c.body ? personalize(c.body) : null, imageUrl: c.imageUrl, url: c.url, actions: c.actions, campaignId: c.id, expiresAt: c.expiresAt };
  const a = c.audience;
  if (a.kind === "everyone" && !a.versionBelow && !a.activeDays && !a.installedDays && !a.excludeCreators && !a.notOpenedLatestDrop && !c.cooldownDays) {
    await db.insert(notifications).values({ ...base, userId: null, screen: a.screen ?? null });
    return;
  }
  const ids = new Set<string>(a.kind === "users" ? (a.userIds ?? []) : []);
  for (const t of targets) if (t.userId) ids.add(t.userId);
  const list = [...ids];
  // {name} etc.: each person's own row is filled in for them
  const text = c.title + " " + (c.body ?? "");
  const vars = await personalVarsFor(list, text);
  const named = PERSONAL_RE.test(text);
  for (let i = 0; i < list.length; i += 1000) {
    await db.insert(notifications).values(
      list.slice(i, i + 1000).map((userId) =>
        named ? { ...base, title: personalize(c.title, vars.get(userId)), body: c.body ? personalize(c.body, vars.get(userId)) : null, userId } : { ...base, userId }
      )
    );
  }
}

let processing = false;

/** Push queued deliveries (all campaigns, or one). */
export async function processQueue(campaignId?: string) {
  if (processing && !campaignId) return;
  if (!campaignId) processing = true;
  try {
    const rules = await getRules();
    // still queued when it expired (e.g. the server was asleep): don't push it late
    const expired = await db.execute<{ campaign_id: string }>(sql`
      UPDATE notification_deliveries d SET status = 'failed', error = 'Expired'
      FROM notification_campaigns c
      WHERE c.id = d.campaign_id AND d.status = 'queued' AND c.expires_at IS NOT NULL AND c.expires_at <= ${new Date().toISOString()}::timestamp
      RETURNING d.campaign_id
    `);
    const expiredIds = [...new Set([...expired].map((r) => r.campaign_id))];
    if (expiredIds.length) await refreshCounts(expiredIds);
    for (let round = 0; round < 50; round++) {
      const batch = await db
        .select({
          id: notificationDeliveries.id,
          channel: notificationDeliveries.channel,
          target: notificationDeliveries.target,
          campaignId: notificationDeliveries.campaignId,
          c: notificationCampaigns,
          p256dh: webPushSubscriptions.p256dh,
          auth: webPushSubscriptions.auth,
          userId: notificationDeliveries.userId,
          appVersion: pushDevices.appVersion,
        })
        .from(notificationDeliveries)
        .innerJoin(notificationCampaigns, eq(notificationCampaigns.id, notificationDeliveries.campaignId))
        .leftJoin(webPushSubscriptions, eq(webPushSubscriptions.endpoint, notificationDeliveries.target))
        .leftJoin(pushDevices, eq(pushDevices.token, notificationDeliveries.target))
        .where(
          and(
            eq(notificationDeliveries.status, "queued"),
            eq(notificationCampaigns.status, "sending"),
            // a campaign is pushed by the request that started it; the scheduler only picks up
            // ones left unfinished for 5+ minutes (e.g. the server restarted mid-send)
            campaignId ? eq(notificationDeliveries.campaignId, campaignId) : lt(notificationCampaigns.startedAt, new Date(Date.now() - 5 * 60_000))
          )
        )
        .limit(300);
      if (!batch.length) break;
      const pv = await personalVarsFor(
        batch.flatMap((d) => (d.userId ? [d.userId] : [])),
        batch.map((d) => d.c.title + " " + (d.c.body ?? "")).join(" ")
      );
      const varsOf = (d: { userId: string | null }) => (d.userId ? pv.get(d.userId) : undefined);

      // daily cap: Aurora-wide pushes already sent today to each target
      const cappedTargets = new Set<string>();
      // (unticking "Respect quiet hours and the daily cap" in Compose skips the cap too)
      const cappable = batch.filter((d) => CAPPED.has(d.c.type as NotificationType) && d.c.kind !== "test" && d.c.respectQuiet);
      if (cappable.length && rules.dailyCap >= 0) {
        const counts = await db
          .select({ target: notificationDeliveries.target, n: sql<number>`count(*)::int` })
          .from(notificationDeliveries)
          .innerJoin(notificationCampaigns, eq(notificationCampaigns.id, notificationDeliveries.campaignId))
          .where(
            and(
              inArray(notificationDeliveries.target, [...new Set(cappable.map((d) => d.target))]),
              gt(notificationDeliveries.sentAt, startOfIstDay()),
              inArray(notificationDeliveries.status, ["sent", "delivered"]),
              inArray(notificationCampaigns.type, [...CAPPED]),
              ne(notificationCampaigns.kind, "test")
            )
          )
          .groupBy(notificationDeliveries.target);
        const sentToday = new Map(counts.map((r) => [r.target, r.n]));
        for (const d of cappable) {
          const n = sentToday.get(d.target) ?? 0;
          if (n >= rules.dailyCap) cappedTargets.add(d.id);
          else sentToday.set(d.target, n + 1);
        }
      }

      const updates: { id: string; status: string; ticket: string | null; error: string | null; sent: boolean }[] = [];
      const deadApp: string[] = [];
      const deadWeb: string[] = [];

      const app = batch.filter((d) => d.channel === "app" && !cappedTargets.has(d.id));
      const messages: ExpoMessage[] = app.map((d) => appMessage(d.c, d.id, d.target, d.appVersion, varsOf(d)));
      const results = messages.length ? await sendExpoPush(messages) : [];
      app.forEach((d, i) => {
        const r = results[i];
        if (r?.ok) updates.push({ id: d.id, status: "sent", ticket: r.ticketId, error: null, sent: true });
        else {
          updates.push({ id: d.id, status: "failed", ticket: null, error: r?.error ?? "Not sent", sent: false });
          if (r && !r.ok && r.dead) deadApp.push(d.target);
        }
      });

      for (const d of batch.filter((x) => x.channel === "web" && !cappedTargets.has(x.id))) {
        if (!d.p256dh || !d.auth) {
          updates.push({ id: d.id, status: "failed", ticket: null, error: "Browser unsubscribed", sent: false });
          continue;
        }
        const r = await sendWebPush({ endpoint: d.target, p256dh: d.p256dh, auth: d.auth }, webPayload(d.c, d.id, varsOf(d)), ttlFor(d.c, d.c.type as NotificationType).ttl ?? 24 * 3600);
        updates.push({ id: d.id, status: r.ok ? "delivered" : "failed", ticket: null, error: r.ok ? null : (r.error ?? "Failed"), sent: r.ok });
        if (r.dead) deadWeb.push(d.target);
      }
      for (const id of cappedTargets) updates.push({ id, status: "capped", ticket: null, error: null, sent: false });

      await applyUpdates(updates);
      if (deadApp.length) await db.update(pushDevices).set({ disabledAt: new Date() }).where(inArray(pushDevices.token, deadApp));
      if (deadWeb.length) await db.update(webPushSubscriptions).set({ disabledAt: new Date() }).where(inArray(webPushSubscriptions.endpoint, deadWeb));
      await refreshCounts([...new Set(batch.map((d) => d.campaignId))]);
    }
  } finally {
    if (!campaignId) processing = false;
  }
}

async function applyUpdates(rows: { id: string; status: string; ticket: string | null; error: string | null; sent: boolean }[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = sql.join(
      chunk.map((r) => sql`(${r.id}::uuid, ${r.status}, ${r.ticket}::text, ${r.error}::text, ${r.sent}::boolean)`),
      sql`, `
    );
    await db.execute(sql`
      UPDATE notification_deliveries d
      SET status = v.status, ticket_id = v.ticket, error = v.error, sent_at = CASE WHEN v.sent THEN now() ELSE d.sent_at END
      FROM (VALUES ${values}) AS v(id, status, ticket, error, sent)
      WHERE d.id = v.id
    `);
  }
}

function deepLinkData(c: Campaign, deliveryId: string) {
  return {
    nid: c.id,
    did: deliveryId,
    type: c.type,
    url: c.url,
    image: c.imageUrl && /^https:\/\//.test(c.imageUrl) ? c.imageUrl : null,
    buttons: (c.actions ?? []).map((a) => ({ id: a.id, label: a.label, url: a.url })),
    actions: Object.fromEntries((c.actions ?? []).map((a) => [a.id, a.url])),
  };
}

/** Placeholders filled in per person when the message goes out. */
export const PERSONAL_KEYS = ["name", "downloads", "likes"] as const;
const PERSONAL_RE = /\{(name|downloads|likes)\}/;
export type PersonalVars = { name?: string | null; downloads?: number; likes?: number };

/** {name} → first name ("there" when signed out or unknown); {downloads} / {likes} → their wallpapers' last 7 days. */
export function personalize(text: string, v?: PersonalVars) {
  if (!PERSONAL_RE.test(text)) return text;
  const first = (v?.name ?? "").trim().split(/\s+/)[0];
  return text
    .replace(/\{name\}/g, first || "there")
    .replace(/\{downloads\}/g, String(v?.downloads ?? 0))
    .replace(/\{likes\}/g, String(v?.likes ?? 0));
}

async function personalVarsFor(userIds: string[], text: string): Promise<Map<string, PersonalVars>> {
  const out = new Map<string, PersonalVars>();
  const ids = [...new Set(userIds)];
  if (!ids.length || !PERSONAL_RE.test(text)) return out;
  const stats = /\{(downloads|likes)\}/.test(text);
  const since = new Date(Date.now() - 7 * 86_400_000);
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const rows = await db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, chunk));
    for (const r of rows) out.set(r.id, { name: r.name, downloads: 0, likes: 0 });
    if (!stats) continue;
    const dl = await db
      .select({ id: wallpapers.uploaderId, n: sql<number>`count(*)::int` })
      .from(downloads)
      .innerJoin(wallpapers, eq(wallpapers.id, downloads.wallpaperId))
      .where(and(inArray(wallpapers.uploaderId, chunk), gt(downloads.createdAt, since)))
      .groupBy(wallpapers.uploaderId);
    const lk = await db
      .select({ id: wallpapers.uploaderId, n: sql<number>`count(*)::int` })
      .from(likes)
      .innerJoin(wallpapers, eq(wallpapers.id, likes.wallpaperId))
      .where(and(inArray(wallpapers.uploaderId, chunk), gt(likes.createdAt, since)))
      .groupBy(wallpapers.uploaderId);
    for (const r of dl) if (r.id && out.has(r.id)) out.get(r.id)!.downloads = r.n;
    for (const r of lk) if (r.id && out.has(r.id)) out.get(r.id)!.likes = r.n;
  }
  return out;
}

function appMessage(c: Campaign, deliveryId: string, token: string, appVersion: string | null, vars: PersonalVars | undefined): ExpoMessage {
  const type = c.type as NotificationType;
  const body = c.body ? personalize(c.body, vars) : null;
  return {
    to: token,
    title: personalize(c.title, vars),
    ...(body ? { body } : {}),
    // `rich`: the app's native module draws it (big picture + buttons, each a deep link)
    data: { rich: true, ...deepLinkData(c, deliveryId) },
    channelId: channelFor(type, appVersion),
    ...(c.actions?.length ? { categoryId: type } : {}),
    priority: "high",
    sound: "default",
    ...ttlFor(c, type),
  };
}

/** Expo drops it if the phone stays offline this long: the type's TTL, never past the expiry. */
function ttlFor(c: Campaign, type: NotificationType): { ttl?: number } {
  const left = c.expiresAt ? Math.floor((c.expiresAt.getTime() - Date.now()) / 1000) : null;
  const ttl = left !== null ? Math.max(60, Math.min(left, TTL[type] ?? left)) : TTL[type];
  return ttl ? { ttl } : {};
}

function webPayload(c: Campaign, deliveryId: string, vars: PersonalVars | undefined) {
  return { title: personalize(c.title, vars), body: personalize(c.body ?? "", vars), tag: c.type, ...deepLinkData(c, deliveryId) };
}

/** Recount a campaign's numbers; a sending campaign with nothing queued is done. */
export async function refreshCounts(ids: string[]) {
  for (const id of ids) {
    await db.execute(sql`
      UPDATE notification_campaigns c SET
        targeted = s.targeted, sent = s.sent, delivered = s.delivered, failed = s.failed, capped = s.capped, opened = s.opened,
        status = CASE WHEN c.status = 'sending' AND s.queued = 0 THEN 'sent' ELSE c.status END,
        finished_at = CASE WHEN c.status = 'sending' AND s.queued = 0 THEN now() ELSE c.finished_at END
      FROM (
        SELECT
          count(*)::int AS targeted,
          count(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent,
          count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
          count(*) FILTER (WHERE status = 'failed')::int AS failed,
          count(*) FILTER (WHERE status = 'capped')::int AS capped,
          count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
          count(*) FILTER (WHERE status = 'queued')::int AS queued
        FROM notification_deliveries WHERE campaign_id = ${id}
      ) s
      WHERE c.id = ${id}
    `);
  }
}

/** Scheduled / held campaigns whose time has come. */
export async function runDueCampaigns() {
  const due = await db
    .select()
    .from(notificationCampaigns)
    .where(and(inArray(notificationCampaigns.status, ["scheduled", "held"]), lte(notificationCampaigns.scheduledFor, new Date())))
    .limit(20);
  for (const c of due) await startCampaign(c).catch((e) => console.error("[notify] start failed:", e instanceof Error ? e.message : e));
}

/** Expo receipts (≥15 min after sending): delivered or failed; uninstalled apps are switched off. */
export async function checkReceipts() {
  const rows = await db
    .select({ id: notificationDeliveries.id, ticketId: notificationDeliveries.ticketId, target: notificationDeliveries.target, campaignId: notificationDeliveries.campaignId })
    .from(notificationDeliveries)
    .where(
      and(
        eq(notificationDeliveries.status, "sent"),
        isNotNull(notificationDeliveries.ticketId),
        isNull(notificationDeliveries.checkedAt),
        lt(notificationDeliveries.sentAt, new Date(Date.now() - 15 * 60_000))
      )
    )
    .limit(1000);
  if (!rows.length) return { checked: 0 };
  const receipts = await getExpoReceipts(rows.map((r) => r.ticketId!));
  const dead: string[] = [];
  const updates: { id: string; status: string; error: string | null }[] = [];
  const stale = Date.now() - 23 * 3600_000;
  for (const r of rows) {
    const rec = receipts[r.ticketId!];
    if (rec) {
      updates.push({ id: r.id, status: rec.ok ? "delivered" : "failed", error: rec.ok ? null : (rec.error ?? "Failed") });
      if (rec.dead) dead.push(r.target);
    }
  }
  for (const u of updates) {
    await db.update(notificationDeliveries).set({ status: u.status as "delivered" | "failed", error: u.error, checkedAt: new Date() }).where(eq(notificationDeliveries.id, u.id));
  }
  // receipts that never came (expired after 24 h): stop asking
  await db
    .update(notificationDeliveries)
    .set({ checkedAt: new Date() })
    .where(and(eq(notificationDeliveries.status, "sent"), isNull(notificationDeliveries.checkedAt), lt(notificationDeliveries.sentAt, new Date(stale))));
  if (dead.length) await db.update(pushDevices).set({ disabledAt: new Date() }).where(inArray(pushDevices.token, dead));
  const ids = [...new Set(rows.map((r) => r.campaignId))];
  await refreshCounts(ids);
  return { checked: updates.length, campaigns: ids };
}

/** A notification (or one of its buttons) was tapped. Counted once per delivery. */
export async function markOpened(deliveryId: string, action: string | null) {
  const [row] = await db
    .update(notificationDeliveries)
    .set({ openedAt: new Date(), action: action?.slice(0, 40) ?? "tap" })
    .where(and(eq(notificationDeliveries.id, deliveryId), isNull(notificationDeliveries.openedAt)))
    .returning({ campaignId: notificationDeliveries.campaignId });
  if (row) await db.update(notificationCampaigns).set({ opened: sql`${notificationCampaigns.opened} + 1` }).where(eq(notificationCampaigns.id, row.campaignId));
  return { ok: true };
}

/** Admin: stop a scheduled or held campaign. */
export async function cancelCampaign(id: string) {
  const [row] = await db
    .update(notificationCampaigns)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(notificationCampaigns.id, id), inArray(notificationCampaigns.status, ["scheduled", "held"])))
    .returning({ id: notificationCampaigns.id });
  return !!row;
}

