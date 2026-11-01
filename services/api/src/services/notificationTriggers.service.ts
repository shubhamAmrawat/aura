import { and, eq, gt, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db } from "../config/db";
import { collections, contentReports, wallpapers } from "../models";
import { thumbUrlSql } from "./wallpaperThumb.service";
import { broadcast, notifyUser, alreadySent } from "./notification.service";
import { getSpotlight } from "./drop.service";
import { getDailyWallpaper, todayInIndia } from "./daily.service";

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
    .select({ id: collections.id, title: collections.title, startsAt: collections.startsAt, publishedAt: collections.publishedAt })
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

let ticking = false;

/** Runs every few minutes (and from the GitHub Actions cron, since the server sleeps when idle). */
export async function runNotificationTick() {
  if (ticking) return { skipped: true };
  ticking = true;
  try {
    await announceLiveDrops().catch((e) => console.error("[notify] drops tick failed:", e instanceof Error ? e.message : e));
    await sendDailyPick().catch((e) => console.error("[notify] daily tick failed:", e instanceof Error ? e.message : e));
    return { skipped: false };
  } finally {
    ticking = false;
  }
}
