import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { notificationCampaigns, notificationDeliveries, pushDevices, users, webPushSubscriptions, type CampaignAudience, type NotificationAction } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { applyCooldown, cancelCampaign, createCampaign, resolveAudience, type NotificationType } from "../notify/engine";
import { unfilledPlaceholders } from "./notificationTemplates.service";
import { getRules } from "../notify/rules";
import { deviceStats } from "../notification.service";
import { getAppVersions } from "../appConfig.service";
import { webPushEnabled } from "../../integrations/webPush";

/** Admin › Notifications: compose, campaigns, a user's phones. */

export type ManualMessage = {
  type: "announcement" | "update" | "drop";
  title: string;
  body: string | null;
  imageUrl: string | null;
  url: string | null;
  actions: NotificationAction[];
};

export async function overview() {
  const [devices, versions, rules] = await Promise.all([deviceStats(), getAppVersions(), getRules()]);
  return { devices, versions, rules, webPush: webPushEnabled() };
}

/** How many phones / browsers / people a composer audience reaches right now. */
export async function previewAudience(audience: CampaignAudience, type: NotificationType, templateId: string | null = null, cooldownDays = 0) {
  const direct = audience.kind === "users" || audience.kind === "devices";
  const targets = await applyCooldown(await resolveAudience(audience, type, direct), templateId, cooldownDays);
  return {
    phones: targets.filter((t) => t.channel === "app").length,
    browsers: targets.filter((t) => t.channel === "web").length,
    people: new Set(targets.filter((t) => t.userId).map((t) => t.userId)).size,
  };
}

export async function sendManual(
  adminId: string,
  m: ManualMessage,
  audience: CampaignAudience,
  scheduledFor: Date | null,
  respectQuiet: boolean,
  from: { templateId: string | null; cooldownDays: number } = { templateId: null, cooldownDays: 0 }
) {
  if (scheduledFor && scheduledFor.getTime() < Date.now() - 60_000) throw new ApiError(400, "That time has passed.");
  assertFilled(m);
  const row = await createCampaign(
    { kind: "manual", ...m, audience, scheduledFor, respectQuiet, createdBy: adminId, templateId: from.templateId, cooldownDays: from.templateId ? from.cooldownDays : 0 },
    { wait: true }
  );
  if (!row) throw new ApiError(409, "Already sent.");
  await logAdminAction({ adminId, action: "notification.send", targetType: "notification", targetId: row.id, details: { title: m.title, audience: audience.kind, scheduled: !!scheduledFor } });
  return campaignDetail(row.id);
}

/** To the admin's own phones and browsers only; skips quiet hours, the cap and the inbox. */
/** {festival} etc. left in the text would go out as-is. */
function assertFilled(m: ManualMessage) {
  const left = unfilledPlaceholders(m.title, m.body);
  if (left.length) throw new ApiError(400, `Fill in ${left.map((k) => `{${k}}`).join(", ")} first.`);
}

export async function sendTest(adminId: string, m: ManualMessage) {
  assertFilled(m);
  const row = await createCampaign({ kind: "test", ...m, title: m.title, audience: { kind: "users", userIds: [adminId] }, respectQuiet: false, createdBy: adminId }, { wait: true });
  if (!row) throw new ApiError(500, "Couldn't send the test");
  const detail = await campaignDetail(row.id);
  if (!detail.campaign.targeted) throw new ApiError(400, "You have no phone or browser with notifications on. Turn them on in the app (or on this site) first.");
  return detail;
}

export async function listCampaigns(filter: "all" | "manual" | "auto" | "scheduled", limit: number, offset: number) {
  const where =
    filter === "manual" ? eq(notificationCampaigns.kind, "manual")
    : filter === "auto" ? eq(notificationCampaigns.kind, "auto")
    : filter === "scheduled" ? inArray(notificationCampaigns.status, ["scheduled", "held"])
    : ne(notificationCampaigns.kind, "test");
  const rows = await db
    .select({
      id: notificationCampaigns.id,
      kind: notificationCampaigns.kind,
      type: notificationCampaigns.type,
      title: notificationCampaigns.title,
      body: notificationCampaigns.body,
      audience: notificationCampaigns.audience,
      status: notificationCampaigns.status,
      scheduledFor: notificationCampaigns.scheduledFor,
      createdAt: notificationCampaigns.createdAt,
      finishedAt: notificationCampaigns.finishedAt,
      targeted: notificationCampaigns.targeted,
      sent: notificationCampaigns.sent,
      delivered: notificationCampaigns.delivered,
      failed: notificationCampaigns.failed,
      capped: notificationCampaigns.capped,
      opened: notificationCampaigns.opened,
    })
    .from(notificationCampaigns)
    .where(and(where, filter === "scheduled" ? ne(notificationCampaigns.kind, "test") : undefined))
    .orderBy(desc(notificationCampaigns.createdAt))
    .limit(limit + 1)
    .offset(offset);
  return { data: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function campaignDetail(id: string) {
  const [campaign] = await db.select().from(notificationCampaigns).where(eq(notificationCampaigns.id, id)).limit(1);
  if (!campaign) throw new ApiError(404, "Not found");
  const taps = await db
    .select({ action: notificationDeliveries.action, n: sql<number>`count(*)::int` })
    .from(notificationDeliveries)
    .where(and(eq(notificationDeliveries.campaignId, id), sql`${notificationDeliveries.openedAt} is not null`))
    .groupBy(notificationDeliveries.action);
  const failures = await db
    .select({
      channel: notificationDeliveries.channel,
      error: notificationDeliveries.error,
      deviceName: pushDevices.deviceName,
      username: users.username,
    })
    .from(notificationDeliveries)
    .leftJoin(pushDevices, eq(pushDevices.token, notificationDeliveries.target))
    .leftJoin(users, eq(users.id, notificationDeliveries.userId))
    .where(and(eq(notificationDeliveries.campaignId, id), eq(notificationDeliveries.status, "failed")))
    .limit(50);
  return { campaign, taps, failures };
}

export async function cancel(adminId: string, id: string) {
  if (!(await cancelCampaign(id))) throw new ApiError(409, "Only scheduled or held notifications can be cancelled.");
  await logAdminAction({ adminId, action: "notification.cancel", targetType: "notification", targetId: id });
  return campaignDetail(id);
}

/** Composer "One person": find accounts, with how many phones/browsers each has. */
export async function searchUsers(q: string) {
  const p = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      phones: sql<number>`(select count(*)::int from push_devices d where d.user_id = ${users.id} and d.disabled_at is null)`,
      browsers: sql<number>`(select count(*)::int from web_push_subscriptions w where w.user_id = ${users.id} and w.disabled_at is null)`,
    })
    .from(users)
    .where(or(ilike(users.username, p), ilike(users.email, p), ilike(users.displayName, p)))
    .limit(8);
}

/** A user's phones and browsers, their switches, and what was sent to them. */
export async function userNotifications(userId: string) {
  const [user] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, email: users.email, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new ApiError(404, "User not found");
  const phones = await db
    .select({
      token: pushDevices.token,
      deviceName: pushDevices.deviceName,
      osVersion: pushDevices.osVersion,
      appVersion: pushDevices.appVersion,
      screen: pushDevices.screen,
      prefs: pushDevices.prefs,
      lastSeenAt: pushDevices.lastSeenAt,
      disabledAt: pushDevices.disabledAt,
    })
    .from(pushDevices)
    .where(eq(pushDevices.userId, userId))
    .orderBy(desc(pushDevices.lastSeenAt));
  const browsers = await db
    .select({
      endpoint: webPushSubscriptions.endpoint,
      userAgent: webPushSubscriptions.userAgent,
      prefs: webPushSubscriptions.prefs,
      lastSeenAt: webPushSubscriptions.lastSeenAt,
      disabledAt: webPushSubscriptions.disabledAt,
    })
    .from(webPushSubscriptions)
    .where(eq(webPushSubscriptions.userId, userId))
    .orderBy(desc(webPushSubscriptions.lastSeenAt));
  const history = await db
    .select({
      id: notificationDeliveries.id,
      title: notificationCampaigns.title,
      type: notificationCampaigns.type,
      kind: notificationCampaigns.kind,
      channel: notificationDeliveries.channel,
      target: notificationDeliveries.target,
      status: notificationDeliveries.status,
      error: notificationDeliveries.error,
      createdAt: notificationDeliveries.createdAt,
      sentAt: notificationDeliveries.sentAt,
      openedAt: notificationDeliveries.openedAt,
    })
    .from(notificationDeliveries)
    .innerJoin(notificationCampaigns, eq(notificationCampaigns.id, notificationDeliveries.campaignId))
    .where(eq(notificationDeliveries.userId, userId))
    .orderBy(desc(notificationDeliveries.createdAt))
    .limit(30);
  return { user, phones, browsers, history };
}

/** Stop pushing to one phone or browser (it re-registers if the app/site turns notifications on again). */
export async function removeTarget(adminId: string, target: string) {
  await db.update(pushDevices).set({ disabledAt: new Date() }).where(and(eq(pushDevices.token, target), isNull(pushDevices.disabledAt)));
  await db.update(webPushSubscriptions).set({ disabledAt: new Date() }).where(and(eq(webPushSubscriptions.endpoint, target), isNull(webPushSubscriptions.disabledAt)));
  await logAdminAction({ adminId, action: "notification.device.remove", targetType: "device", details: { target: target.slice(0, 60) } });
  return { ok: true };
}
