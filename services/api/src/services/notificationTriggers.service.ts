import { and, eq, gt, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db } from "../config/db";
import { collections, contentReports, notificationCampaigns, wallpapers, type NotificationAction } from "../models";
import { thumbUrlSql } from "./wallpaperThumb.service";
import { alreadySent, checkReceipts, createCampaign, processQueue, runDueCampaigns, type NotificationType } from "./notify/engine";
import { getRules, type AutoKey } from "./notify/rules";
import { getSpotlight } from "./drop.service";
import { getDailyWallpaper, todayInIndia } from "./daily.service";

type Auto = {
  type: NotificationType;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  actions?: NotificationAction[];
  dedupeKey: string;
  expiresAt?: Date | null;
};

const AUTO_OF: Partial<Record<NotificationType, AutoKey>> = {
  drop: "drop", daily: "daily", upload_live: "upload_live", upload_rejected: "upload_rejected", milestone: "milestone",
  creator_approved: "creator", creator_rejected: "creator", report_reviewed: "report",
};

/** An automatic notification to one person (if that automatic notification is switched on). Never throws. */
async function notifyUser(userId: string, n: Auto) {
  try {
    const key = AUTO_OF[n.type];
    if (key && !(await getRules()).auto[key]) return;
    await createCampaign({ kind: "auto", ...n, audience: { kind: "users", userIds: [userId] } });
  } catch (e) {
    console.error(`[notify] ${n.type} failed:`, e instanceof Error ? e.message : e);
  }
}

/** An automatic notification to everyone (phones + browsers that want it). Never throws. */
async function broadcast(n: Auto & { screen?: "mobile" | "tablet" | null }) {
  try {
    const key = AUTO_OF[n.type];
    if (key && !(await getRules()).auto[key]) return null;
    const { screen, ...rest } = n;
    return await createCampaign({ kind: "auto", ...rest, audience: { kind: "everyone", screen: screen ?? null, includeWeb: !screen } });
  } catch (e) {
    console.error(`[notify] broadcast ${n.type} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Alerts to every admin (app + browsers), if that alert is switched on. Never throws. */
const ALERT_TYPE = { report: "admin_report", application: "admin_application", deliveryProblems: "admin_delivery", signup: "admin_signup" } as const satisfies Record<string, NotificationType>;

export async function alertAdmins(kind: keyof typeof ALERT_TYPE, n: Omit<Auto, "type">) {
  try {
    if (!(await getRules()).alerts[kind]) return;
    const type: NotificationType = ALERT_TYPE[kind];
    await createCampaign({ kind: "auto", type, ...n, audience: { kind: "admins" } });
  } catch (e) {
    console.error(`[notify] admin alert failed:`, e instanceof Error ? e.message : e);
  }
}

/**
 * What each event sends. URLs are paths that exist on both the app and the website
 * (/wallpaper/:id, /collection/:id), https links, or null (= open the inbox).
 * Action ids must match the categories the app registers (lib/notifications.ts).
 */

const SITE = "https://www.aurora-walls.com";

async function wallpaperInfo(id: string) {
  const [w] = await db
    .select({ id: wallpapers.id, title: wallpapers.title, uploaderId: wallpapers.uploaderId, thumbUrl: thumbUrlSql, fileUrl: wallpapers.fileUrl })
    .from(wallpapers)
    .where(eq(wallpapers.id, id))
    .limit(1);
  return w ?? null;
}

const quoted = (t: string | null | undefined) => `“${(t || "Untitled").slice(0, 60)}”`;

/** A creator's upload was approved or rejected by an admin. */
export async function notifyUploadDecision(wallpaperId: string, approved: boolean, reason?: string | null) {
  const w = await wallpaperInfo(wallpaperId);
  if (!w?.uploaderId) return; // admin uploads have no one to tell
  const image = w.thumbUrl ?? w.fileUrl;
  if (approved) {
    await notifyUser(w.uploaderId, {
      type: "upload_live",
      title: `${quoted(w.title)} is live`,
      body: "Your wallpaper is now on Aurora.",
      imageUrl: image,
      url: `/wallpaper/${w.id}`,
      actions: [
        { id: "view", label: "View", url: `/wallpaper/${w.id}` },
        { id: "apply", label: "Set as wallpaper", url: `/wallpaper/${w.id}?apply=1` },
      ],
      dedupeKey: `upload_live:${w.id}`,
    });
  } else {
    await notifyUser(w.uploaderId, {
      type: "upload_rejected",
      title: `${quoted(w.title)} wasn't approved`,
      body: reason?.trim() || "It didn't meet our upload guidelines.",
      imageUrl: image,
      url: null,
      actions: [
        { id: "why", label: "See why", url: "/notifications" },
        { id: "reupload", label: "Upload again", url: `${SITE}/upload` },
      ],
      // a wallpaper can be rejected again after a restore; keep each decision
      dedupeKey: `upload_rejected:${w.id}:${Date.now()}`,
    });
  }
}

/** A creator application was decided. */
export async function notifyCreatorDecision(userId: string, applicationId: string, approved: boolean, note: string | null) {
  await notifyUser(userId, approved
    ? {
        type: "creator_approved",
        title: "You're an Aurora creator",
        body: note?.trim() || "Your application was approved. Upload your first wallpapers on the website.",
        url: `${SITE}/upload`,
        dedupeKey: `creator:${applicationId}`,
      }
    : {
        type: "creator_rejected",
        title: "Your creator application wasn't approved",
        body: note?.trim() || "You can apply again later.",
        url: null,
        dedupeKey: `creator:${applicationId}`,
      });
}

/** Reports were closed: tell each person who reported (once per report). */
export async function notifyReportsReviewed(reportIds: string[], status: "actioned" | "dismissed") {
  if (!reportIds.length) return;
  const rows = await db
    .select({ id: contentReports.id, reporterId: contentReports.reporterId, label: contentReports.targetLabel })
    .from(contentReports)
    .where(and(inArray(contentReports.id, reportIds), isNotNull(contentReports.reporterId)));
  for (const r of rows) {
    const what = r.label ? quoted(r.label) : "what you reported";
    await notifyUser(r.reporterId!, {
      type: "report_reviewed",
      title: "Your report was reviewed",
      body: status === "actioned" ? `We took action on ${what}. Thanks for helping keep Aurora safe.` : `We looked at ${what} and it doesn't break our rules. Thanks for letting us know.`,
      url: null,
      dedupeKey: `report:${r.id}`,
    });
  }
}

const LIKE_MILESTONES = new Set([10, 50, 100, 500, 1000, 5000, 10000]);

/** Called after a like: tells the creator when a wallpaper reaches 10, 50, 100… likes. */
export async function notifyLikeMilestone(wallpaperId: string, likeCount: number) {
  if (!LIKE_MILESTONES.has(likeCount)) return;
  const w = await wallpaperInfo(wallpaperId);
  if (!w?.uploaderId) return;
  await notifyUser(w.uploaderId, {
    type: "milestone",
    title: `${quoted(w.title)} reached ${likeCount.toLocaleString("en-IN")} likes`,
    body: "People love it. Share it to keep it going.",
    imageUrl: w.thumbUrl ?? w.fileUrl,
    url: `/wallpaper/${w.id}`,
    dedupeKey: `likes:${w.id}:${likeCount}`,
  });
}

// ─── scheduled: drop live, wallpaper of the day ─────────────

/** Only announce drops that started recently (not ones already running for days). */
const DROP_ANNOUNCE_WINDOW_MS = 48 * 3600_000;

async function announceLiveDrops() {
  const now = new Date();
  const live = await db
    .select({ id: collections.id, title: collections.title, startsAt: collections.startsAt, endsAt: collections.endsAt, publishedAt: collections.publishedAt })
    .from(collections)
    .where(
      and(
        eq(collections.kind, "drop"),
        isNotNull(collections.publishedAt),
        eq(collections.showOnApp, true),
        or(isNull(collections.startsAt), lte(collections.startsAt, now)),
        or(isNull(collections.endsAt), gt(collections.endsAt, now))
      )
    );
  for (const d of live) {
    const started = d.startsAt && d.publishedAt ? new Date(Math.max(d.startsAt.getTime(), d.publishedAt.getTime())) : (d.startsAt ?? d.publishedAt);
    if (!started || now.getTime() - started.getTime() > DROP_ANNOUNCE_WINDOW_MS) continue;
    const key = `drop:${d.id}`;
    if (await alreadySent(key)) continue;
    const art = await getSpotlight("app", "mobile").then((s) => (s?.id === d.id ? s : null)).catch(() => null);
    const count = art?.wallpaperCount;
    const ends = art?.endsAt ? new Date(art.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : null;
    const first = art?.preview[0];
    await broadcast({
      type: "drop",
      title: `${d.title} is live`,
      body: [count ? `${count} new wallpapers` : "New wallpapers", ends ? `until ${ends}` : null].filter(Boolean).join(", ") + ".",
      imageUrl: first ? (first.thumbUrl ?? first.fileUrl) : null,
      url: `/collection/${d.id}`,
      actions: [
        { id: "explore", label: "Explore", url: `/collection/${d.id}` },
        { id: "autochange", label: "Auto-change from it", url: `/settings/wallpaper-changer?dropId=${d.id}&dropName=${encodeURIComponent(d.title)}` },
      ],
      dedupeKey: key,
      expiresAt: d.endsAt,
    });
    console.log(`[notify] announced drop ${d.title}`);
  }
}

/** 9:00–12:00 IST: send today's pick (once per day per screen shape). Later than that, skip the day. */
async function sendDailyPick() {
  const hourIst = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  if (hourIst < 9 || hourIst >= 12) return;
  const day = todayInIndia();
  for (const screen of ["mobile", "tablet"] as const) {
    const key = `daily:${day}:${screen}`;
    if (await alreadySent(key)) continue;
    const { wallpaper: w } = await getDailyWallpaper(screen);
    if (!w) continue;
    await broadcast({
      type: "daily",
      title: `Today's wallpaper: ${(w.title || "Untitled").slice(0, 60)}`,
      body: [w.categoryName, "A new pick every morning."].filter(Boolean).join(" · "),
      imageUrl: w.thumbUrl ?? w.fileUrl,
      url: `/wallpaper/${w.id}`,
      actions: [
        { id: "apply", label: "Set as wallpaper", url: `/wallpaper/${w.id}?apply=1` },
        { id: "save", label: "Save", url: `/wallpaper/${w.id}?save=1` },
      ],
      screen,
      dedupeKey: key,
    });
  }
}

/** After receipts: tell admins when more than 10% of a send failed (once per campaign). */
async function deliveryProblemAlerts(ids: string[]) {
  if (!ids.length) return;
  const rows = await db
    .select({ id: notificationCampaigns.id, title: notificationCampaigns.title, sent: notificationCampaigns.sent, failed: notificationCampaigns.failed, type: notificationCampaigns.type })
    .from(notificationCampaigns)
    .where(inArray(notificationCampaigns.id, ids));
  for (const c of rows) {
    if (c.type.startsWith("admin_") || c.sent + c.failed < 10 || c.failed / (c.sent + c.failed) <= 0.1) continue;
    await alertAdmins("deliveryProblems", {
      title: `Delivery problems: “${c.title.slice(0, 50)}”`,
      body: `${c.failed} of ${c.sent + c.failed} pushes failed.`,
      url: `${SITE}/admin/notifications?campaign=${c.id}`,
      dedupeKey: `alert:delivery:${c.id}`,
    });
  }
}

let ticking = false;

/** Runs every few minutes (and from the GitHub Actions cron, since the server sleeps when idle). */
export async function runNotificationTick() {
  if (ticking) return { skipped: true };
  ticking = true;
  const step = async (name: string, fn: () => Promise<unknown>) =>
    fn().catch((e) => console.error(`[notify] ${name} failed:`, e instanceof Error ? e.message : e));
  try {
    await step("drops", announceLiveDrops);
    await step("daily", sendDailyPick);
    await step("due campaigns", runDueCampaigns);
    await step("queue", () => processQueue());
    await step("receipts", async () => {
      const r = await checkReceipts();
      if ("campaigns" in r && r.campaigns) await deliveryProblemAlerts(r.campaigns);
    });
    return { skipped: false };
  } finally {
    ticking = false;
  }
}
