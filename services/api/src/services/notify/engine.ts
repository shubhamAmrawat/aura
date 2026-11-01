import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/db";
import {
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
  | "admin_report" | "admin_application" | "admin_delivery";

type PrefKey = keyof NotificationPrefs;

export const PREF: Record<NotificationType, PrefKey> = {
  drop: "drops", daily: "daily", update: "updates", announcement: "updates",
  upload_live: "uploads", upload_rejected: "uploads", milestone: "milestones",
  creator_approved: "account", creator_rejected: "account", report_reviewed: "account",
  admin_report: "account", admin_application: "account", admin_delivery: "account",
};

export const PREF_DEFAULTS: Required<NotificationPrefs> = { drops: true, daily: false, updates: true, uploads: true, milestones: true, account: true };

const CHANNEL: Record<NotificationType, string> = {
  drop: "drops", daily: "daily", update: "updates", announcement: "updates",
  upload_live: "uploads", upload_rejected: "uploads", milestone: "uploads",
  creator_approved: "account", creator_rejected: "account", report_reviewed: "account",
  admin_report: "account", admin_application: "account", admin_delivery: "account",
};

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
    })
    .onConflictDoNothing({ target: notificationCampaigns.dedupeKey })
    .returning();
  if (!row) return null;
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

  const appRows = await db
    .select({ token: pushDevices.token, userId: pushDevices.userId, appVersion: pushDevices.appVersion })
    .from(pushDevices)
    .where(
      and(
        isNull(pushDevices.disabledAt),
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
          ignorePrefs ? undefined : prefOn(webPushSubscriptions.prefs),
          a.kind === "devices" ? (a.targets?.length ? inArray(webPushSubscriptions.endpoint, a.targets) : sql`false`) : userFilter(webPushSubscriptions.userId, a),
          a.activeDays ? (a.activeDays > 0 ? gt(webPushSubscriptions.lastSeenAt, new Date(Date.now() - a.activeDays * 86_400_000)) : lt(webPushSubscriptions.lastSeenAt, new Date(Date.now() + a.activeDays * 86_400_000))) : undefined
        )
      );
    for (const r of webRows) out.push({ channel: "web", target: r.endpoint, userId: r.userId, p256dh: r.p256dh, auth: r.auth });
  }
  return out;
}

/** Admin sends to specific people or phones are direct messages: they skip the person's switches. */
const isDirect = (c: { kind: string; audience: CampaignAudience }) => c.kind === "test" || (c.kind === "manual" && (c.audience.kind === "users" || c.audience.kind === "devices"));

// ─── sending ────────────────────────────────────────────────

/** Due now: hold for quiet hours, or resolve the audience and send. */
async function startCampaign(c: Campaign) {
  const type = c.type as NotificationType;
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

  const targets = await resolveAudience(c.audience, type, isDirect(c));
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
  const base = { type: c.type, title: c.title, body: c.body, imageUrl: c.imageUrl, url: c.url, actions: c.actions, campaignId: c.id };
  const a = c.audience;
  if (a.kind === "everyone" && !a.versionBelow && !a.activeDays) {
    await db.insert(notifications).values({ ...base, userId: null, screen: a.screen ?? null });
    return;
  }
  const ids = new Set<string>(a.kind === "users" ? (a.userIds ?? []) : []);
  for (const t of targets) if (t.userId) ids.add(t.userId);
  const list = [...ids];
  for (let i = 0; i < list.length; i += 1000) {
    await db.insert(notifications).values(list.slice(i, i + 1000).map((userId) => ({ ...base, userId })));
  }
}

let processing = false;

/** Push queued deliveries (all campaigns, or one). */
export async function processQueue(campaignId?: string) {
  if (processing && !campaignId) return;
  if (!campaignId) processing = true;
  try {
    const rules = await getRules();
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
        })
        .from(notificationDeliveries)
        .innerJoin(notificationCampaigns, eq(notificationCampaigns.id, notificationDeliveries.campaignId))
        .leftJoin(webPushSubscriptions, eq(webPushSubscriptions.endpoint, notificationDeliveries.target))
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

      // daily cap: Aurora-wide pushes already sent today to each target
      const cappedTargets = new Set<string>();
      const cappable = batch.filter((d) => CAPPED.has(d.c.type as NotificationType) && d.c.kind !== "test");
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
      const messages: ExpoMessage[] = app.map((d) => appMessage(d.c, d.id, d.target));
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
        const r = await sendWebPush({ endpoint: d.target, p256dh: d.p256dh, auth: d.auth }, webPayload(d.c, d.id), TTL[d.c.type as NotificationType] ?? 24 * 3600);
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

function appMessage(c: Campaign, deliveryId: string, token: string): ExpoMessage {
  const type = c.type as NotificationType;
  return {
    to: token,
    title: c.title,
    ...(c.body ? { body: c.body } : {}),
    // `rich`: the app's native module draws it (big picture + buttons, each a deep link)
    data: { rich: true, ...deepLinkData(c, deliveryId) },
    channelId: CHANNEL[type] ?? "updates",
    ...(c.actions?.length ? { categoryId: type } : {}),
    priority: "high",
    sound: "default",
    ...(TTL[type] ? { ttl: TTL[type] } : {}),
  };
}

function webPayload(c: Campaign, deliveryId: string) {
  return { title: c.title, body: c.body ?? "", tag: c.type, ...deepLinkData(c, deliveryId) };
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

