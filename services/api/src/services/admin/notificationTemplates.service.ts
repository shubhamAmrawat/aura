import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { downloads, notificationTemplates, wallpapers, type CampaignAudience, type NotificationAction, type TemplateCategory, type TemplateImageSource } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { thumbUrlSql } from "../wallpaperThumb.service";
import { getSpotlight } from "../drop.service";
import { getAppVersions } from "../appConfig.service";
import { PERSONAL_KEYS } from "../notify/engine";

/**
 * Admin › Notifications › Templates. Built-ins live here as code (seeded into the table the first
 * time the list is loaded; "Reset" puts one back). Using a template fills in what the server knows
 * ({drop}, {count}, {ends}, {wallpaper}, {version}) and leaves the rest for the admin
 * ({festival}, {category}, {summary}…). Per-person ones ({name}, {downloads}, {likes}) are
 * filled in for each person when it goes out.
 */

export type TemplateInput = {
  category: TemplateCategory;
  name: string;
  description: string | null;
  type: "announcement" | "update" | "drop";
  title: string;
  body: string | null;
  imageSource: TemplateImageSource;
  imageUrl: string | null;
  url: string | null;
  actions: NotificationAction[];
  audience: CampaignAudience;
  bestTime: string | null;
  cooldownDays: number;
};

type Builtin = TemplateInput & { key: string };

const BUILTINS: Builtin[] = [
  {
    key: "we_miss_you", category: "reengage", name: "We miss you",
    description: "Bring back people who haven't opened the app in two weeks.",
    type: "announcement", title: "We miss you, {name}", body: "{count} new wallpapers since your last visit. Come take a look.",
    imageSource: "wallpaper", imageUrl: null, url: "/feed/latest", actions: [],
    audience: { kind: "everyone", activeDays: -14 }, bestTime: "Best at 7 PM", cooldownDays: 30,
  },
  {
    key: "try_autochange", category: "reengage", name: "Try Auto-change",
    description: "Nudge quiet users toward the Wallpaper changer.",
    type: "announcement", title: "Same wallpaper for a while?", body: "Let Aurora change it for you every day. Pick a category or your likes.",
    imageSource: "none", imageUrl: null, url: "/settings/wallpaper-changer", actions: [],
    audience: { kind: "signedIn", activeDays: -7 }, bestTime: "Best at 8 PM", cooldownDays: 60,
  },
  {
    key: "drop_last_call", category: "reengage", name: "Drop ending, didn't open",
    description: "Last call for people who didn't open the drop notification.",
    type: "drop", title: "Last call: {drop} ends {ends}", body: "{count} wallpapers. Open it before it's gone.",
    imageSource: "drop", imageUrl: null, url: "@drop", actions: [{ id: "explore", label: "Explore", url: "@drop" }],
    audience: { kind: "everyone", notOpenedLatestDrop: true }, bestTime: "Day it ends, 6 PM", cooldownDays: 7,
  },
  {
    key: "sign_in_to_save", category: "growth", name: "Sign in to save",
    description: "Signed-out phones that have had the app for a few days.",
    type: "announcement", title: "Keep your favourites safe", body: "Sign in to keep your likes and collections on every device.",
    imageSource: "none", imageUrl: null, url: "/auth", actions: [{ id: "signin", label: "Sign in", url: "/auth" }],
    audience: { kind: "signedOut", installedDays: 3 }, bestTime: "Any time", cooldownDays: 14,
  },
  {
    key: "unlock_changer", category: "growth", name: "Unlock the changer",
    description: "Sell the Wallpaper changer to signed-out phones.",
    type: "announcement", title: "A new wallpaper every day", body: "Create a free account to turn on the Wallpaper changer.",
    imageSource: "wallpaper", imageUrl: null, url: "/auth", actions: [{ id: "signup", label: "Create account", url: "/auth" }],
    audience: { kind: "signedOut", installedDays: 7 }, bestTime: "Best at 7 PM", cooldownDays: 30,
  },
  {
    key: "drop_live", category: "promotion", name: "Drop is live",
    description: "Announce the live drop (the automatic one does this too, once).",
    type: "drop", title: "{drop} is live", body: "{count} new wallpapers, only until {ends}.",
    imageSource: "drop", imageUrl: null, url: "@drop", actions: [{ id: "explore", label: "Explore", url: "@drop" }],
    audience: { kind: "everyone" }, bestTime: "When the drop starts", cooldownDays: 7,
  },
  {
    key: "trending_week", category: "promotion", name: "Trending this week",
    description: "The most-downloaded wallpaper of the last 7 days.",
    type: "announcement", title: "Trending this week: {wallpaper}", body: "The most-downloaded wallpaper on Aurora right now.",
    imageSource: "wallpaper", imageUrl: null, url: "@wallpaper", actions: [{ id: "view", label: "View", url: "@wallpaper" }],
    audience: { kind: "everyone", activeDays: 30 }, bestTime: "Sunday 7 PM", cooldownDays: 7,
  },
  {
    key: "festival_wishes", category: "seasonal", name: "Festival wishes",
    description: "Greet everyone on a festival and point to its collection.",
    type: "announcement", title: "Happy {festival}, {name}", body: "Light up your screen with our {festival} collection.",
    imageSource: "drop", imageUrl: null, url: "@drop", actions: [],
    audience: { kind: "everyone" }, bestTime: "Festival morning", cooldownDays: 20,
  },
  {
    key: "new_version", category: "info", name: "New version",
    description: "Tell older apps that an update is out (goes to apps below the latest version).",
    type: "update", title: "Aurora {version} is ready", body: "New features and fixes. Updating takes a few seconds.",
    imageSource: "none", imageUrl: null, url: "aurora://update", actions: [{ id: "update", label: "Update", url: "aurora://update" }],
    audience: { kind: "everyone" }, bestTime: "Any time", cooldownDays: 14,
  },
  {
    key: "whats_new", category: "info", name: "What's new",
    description: "A short note about something new.",
    type: "announcement", title: "New in Aurora", body: "{summary}",
    imageSource: "none", imageUrl: null, url: null, actions: [],
    audience: { kind: "everyone" }, bestTime: "Any time", cooldownDays: 0,
  },
  {
    key: "creator_weekly", category: "creators", name: "Weekly creator stats",
    description: "Each creator's downloads and likes from the last 7 days.",
    type: "announcement", title: "Your week on Aurora", body: "Your wallpapers got {downloads} downloads and {likes} likes this week.",
    imageSource: "none", imageUrl: null, url: null, actions: [],
    audience: { kind: "creators" }, bestTime: "Monday 10 AM", cooldownDays: 6,
  },
  {
    key: "become_creator", category: "creators", name: "Become a creator",
    description: "Invite active signed-in people to apply as creators.",
    type: "announcement", title: "Share your art on Aurora", body: "Apply to become a creator and publish your own wallpapers.",
    imageSource: "none", imageUrl: null, url: "https://www.aurora-walls.com/creator/apply", actions: [],
    audience: { kind: "signedIn", activeDays: 30, excludeCreators: true }, bestTime: "Any time", cooldownDays: 60,
  },
];

const fromBuiltin = (b: Builtin) => ({ ...b, builtin: true });

async function seedBuiltins() {
  await db.insert(notificationTemplates).values(BUILTINS.map(fromBuiltin)).onConflictDoNothing({ target: notificationTemplates.key });
}

let seeded = false;

export async function listTemplates() {
  if (!seeded) {
    await seedBuiltins();
    seeded = true;
  }
  const rows = await db
    .select()
    .from(notificationTemplates)
    .where(isNull(notificationTemplates.archivedAt))
    .orderBy(desc(notificationTemplates.builtin), asc(notificationTemplates.category), asc(notificationTemplates.createdAt));
  return rows.map((r) => ({ ...r, modified: r.builtin ? isModified(r) : false }));
}

function isModified(r: typeof notificationTemplates.$inferSelect) {
  const b = BUILTINS.find((x) => x.key === r.key);
  if (!b) return false;
  const pick = (t: TemplateInput) => JSON.stringify([t.category, t.name, t.type, t.title, t.body, t.imageSource, t.imageUrl, t.url, t.actions, t.audience, t.bestTime, t.cooldownDays]);
  return pick(b) !== pick(r as TemplateInput);
}

export async function getTemplate(id: string) {
  const [row] = await db.select().from(notificationTemplates).where(eq(notificationTemplates.id, id)).limit(1);
  if (!row || row.archivedAt) throw new ApiError(404, "Template not found");
  return row;
}

export async function createTemplate(adminId: string, input: TemplateInput) {
  const [row] = await db.insert(notificationTemplates).values({ ...input, builtin: false, createdBy: adminId }).returning();
  await logAdminAction({ adminId, action: "notification_template.create", targetType: "notification_template", targetId: row!.id, details: { name: input.name } });
  return row!;
}

export async function updateTemplate(adminId: string, id: string, input: TemplateInput) {
  await getTemplate(id);
  const [row] = await db.update(notificationTemplates).set({ ...input, updatedAt: new Date() }).where(eq(notificationTemplates.id, id)).returning();
  await logAdminAction({ adminId, action: "notification_template.update", targetType: "notification_template", targetId: id, details: { name: input.name } });
  return row!;
}

/** Custom ones are archived (campaigns keep pointing at them); built-ins can only be reset. */
export async function deleteTemplate(adminId: string, id: string) {
  const t = await getTemplate(id);
  if (t.builtin) throw new ApiError(400, "Built-in templates can't be deleted. Use Reset instead.");
  await db.update(notificationTemplates).set({ archivedAt: new Date() }).where(eq(notificationTemplates.id, id));
  await logAdminAction({ adminId, action: "notification_template.delete", targetType: "notification_template", targetId: id, details: { name: t.name } });
  return { ok: true };
}

export async function resetTemplate(adminId: string, id: string) {
  const t = await getTemplate(id);
  const b = BUILTINS.find((x) => x.key === t.key);
  if (!b) throw new ApiError(400, "Only built-in templates can be reset.");
  const { key: _key, ...input } = b;
  const [row] = await db.update(notificationTemplates).set({ ...input, updatedAt: new Date() }).where(eq(notificationTemplates.id, id)).returning();
  await logAdminAction({ adminId, action: "notification_template.reset", targetType: "notification_template", targetId: id, details: { name: b.name } });
  return row!;
}

// ─── using a template ────────────────────────────────────────

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const TOKEN = /\{([a-z]+)\}/g;
const tokensIn = (s: string) => [...s.matchAll(TOKEN)].map((m) => m[1]!);

async function trendingWallpaper() {
  const [w] = await db
    .select({ id: wallpapers.id, title: wallpapers.title, thumbUrl: thumbUrlSql, fileUrl: wallpapers.fileUrl, n: sql<number>`count(*)::int` })
    .from(downloads)
    .innerJoin(wallpapers, eq(wallpapers.id, downloads.wallpaperId))
    .where(and(gt(downloads.createdAt, new Date(Date.now() - 7 * 86_400_000)), eq(wallpapers.status, "approved")))
    .groupBy(wallpapers.id)
    .orderBy(desc(sql`count(*)`))
    .limit(1);
  return w ?? null;
}

async function newWallpaperCount(days: number) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(wallpapers)
    .where(and(eq(wallpapers.status, "approved"), gt(wallpapers.createdAt, new Date(Date.now() - days * 86_400_000))));
  return r?.n ?? 0;
}

/**
 * Fill a template with what the server knows right now. Returns the message ready for Compose,
 * the values used, what the admin still has to fill in, and problems (e.g. no live drop).
 */
export async function prepareTemplate(id: string) {
  const t = await getTemplate(id);
  const text = [t.title, t.body ?? "", t.url ?? "", ...t.actions.map((a) => a.url)].join(" ");
  const needs = new Set(tokensIn(t.title + " " + (t.body ?? "")));
  const usesDrop = needs.has("drop") || needs.has("ends") || t.imageSource === "drop" || text.includes("@drop");
  const usesWallpaper = needs.has("wallpaper") || t.imageSource === "wallpaper" || text.includes("@wallpaper");

  const values: Record<string, string> = {};
  const problems: string[] = [];
  let dropLink: string | null = null;
  let wallpaperLink: string | null = null;
  let image: string | null = t.imageSource === "custom" ? t.imageUrl : null;

  if (usesDrop) {
    const d = await getSpotlight("app", "mobile").catch(() => null);
    if (d) {
      values.drop = d.title;
      if (d.endsAt) values.ends = fmtDate(new Date(d.endsAt));
      if (needs.has("drop") || needs.has("ends")) values.count = String(d.wallpaperCount);
      dropLink = `/collection/${d.id}`;
      const first = d.preview[0];
      if (t.imageSource === "drop" && first) image = first.thumbUrl ?? first.fileUrl;
    } else problems.push("There's no live drop right now, so {drop} and its link can't be filled in.");
  }
  if (usesWallpaper) {
    const w = await trendingWallpaper();
    if (w) {
      values.wallpaper = w.title || "Untitled";
      wallpaperLink = `/wallpaper/${w.id}`;
      if (t.imageSource === "wallpaper") image = w.thumbUrl ?? w.fileUrl;
    } else problems.push("No downloads in the last 7 days, so there's no trending wallpaper.");
  }
  if (needs.has("count") && !values.count) {
    const a = t.audience.activeDays;
    values.count = String(await newWallpaperCount(a && a < 0 ? -a : 7));
  }
  const audience: CampaignAudience = { ...t.audience };
  if (needs.has("version") || t.type === "update") {
    const v = await getAppVersions();
    if (v.latest) {
      values.version = v.latest;
      if (t.type === "update") audience.versionBelow = v.latest;
    } else problems.push("Set the latest app version in Rules first, so {version} can be filled in.");
  }

  const fill = (s: string) => s.replace(TOKEN, (m, k: string) => values[k] ?? m);
  const link = (u: string | null) => (u === "@drop" ? dropLink : u === "@wallpaper" ? wallpaperLink : u);
  const title = fill(t.title);
  const body = t.body ? fill(t.body) : null;
  const personal = new Set<string>(PERSONAL_KEYS);
  const missing = [...new Set(tokensIn(title + " " + (body ?? "")))].filter((k) => !personal.has(k));

  return {
    template: { id: t.id, name: t.name, category: t.category, bestTime: t.bestTime },
    message: {
      type: t.type,
      title,
      body,
      imageUrl: image,
      url: link(t.url),
      actions: t.actions.flatMap((a) => {
        const u = link(a.url);
        return u ? [{ ...a, url: u }] : [];
      }),
    },
    audience,
    cooldownDays: t.cooldownDays,
    values,
    /** placeholders the admin fills in (e.g. festival) */
    missing,
    /** placeholders filled in for each person */
    personal: [...new Set(tokensIn(title + " " + (body ?? "")))].filter((k) => personal.has(k)),
    problems,
  };
}

/** Text still holding a placeholder the admin should have filled in. */
export function unfilledPlaceholders(...texts: (string | null | undefined)[]) {
  const personal = new Set<string>(PERSONAL_KEYS);
  return [...new Set(texts.flatMap((s) => (s ? tokensIn(s) : [])))].filter((k) => !personal.has(k));
}

