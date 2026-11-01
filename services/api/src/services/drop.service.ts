import { and, asc, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../config/db";
import { collections, collectionWallpapers, wallpapers } from "../models";
import { ApiError } from "../utils/ApiError";
import { logAdminAction } from "../utils/audit";
import { visibleCategorySql, type ScreenFilter } from "../utils/screenFilter";
import { thumbUrlSql } from "./wallpaperThumb.service";
import type { DropBodyInput } from "../validators/drop.schema";

/**
 * Drops: editorial collections (collections.kind = 'drop') made by admins, e.g. "Diwali Drops".
 * Published + inside [startsAt, endsAt) → banner on the app/web home (per showOnApp/showOnWeb).
 * After it ends the drop page still opens (shared links); only the banner goes away.
 */

export type DropStatus = "draft" | "scheduled" | "live" | "ended";
type DropTimes = { publishedAt: Date | null; startsAt: Date | null; endsAt: Date | null };

export function dropStatus(d: DropTimes, now = new Date()): DropStatus {
  if (!d.publishedAt) return "draft";
  if (d.startsAt && d.startsAt > now) return "scheduled";
  if (d.endsAt && d.endsAt <= now) return "ended";
  return "live";
}

/** Public can open a drop once it's published and has started (ended drops stay reachable). */
export function isDropPublic(d: DropTimes, now = new Date()) {
  const s = dropStatus(d, now);
  return s === "live" || s === "ended";
}

// ─── accent colour, picked from the wallpapers ──────────────

const FALLBACK_ACCENT = "#81EE4E";

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** The most colourful of the first wallpapers' dominant colours, made bright enough for a button on black. */
export function accentFrom(colors: (string | null | undefined)[]): string {
  let best: [number, number, number] | null = null;
  for (const c of colors.slice(0, 6)) {
    const hsl = c ? hexToHsl(c) : null;
    if (!hsl) continue;
    // weight saturation down for near-black/near-white colours (their hue is noise)
    const score = hsl[1] * (1 - Math.abs(2 * hsl[2] - 1));
    if (!best || score > best[1] * (1 - Math.abs(2 * best[2] - 1))) best = hsl;
  }
  if (!best || best[1] * (1 - Math.abs(2 * best[2] - 1)) < 0.06) return FALLBACK_ACCENT;
  return hslToHex(best[0], Math.max(best[1], 0.75), 0.62);
}

// ─── public ─────────────────────────────────────────────────

const itemFields = {
  id: wallpapers.id,
  title: wallpapers.title,
  fileUrl: wallpapers.fileUrl,
  thumbUrl: thumbUrlSql,
  blurhash: wallpapers.blurhash,
  dominantColor: wallpapers.dominantColor,
  width: wallpapers.width,
  height: wallpapers.height,
  isMobile: wallpapers.isMobile,
};

/** What the public sees of a drop: approved wallpapers in non-hidden categories. */
const publicItems = (dropId: string) =>
  and(eq(collectionWallpapers.collectionId, dropId), eq(wallpapers.status, "approved"), visibleCategorySql);

const screenWhere = (screen: ScreenFilter | null) =>
  screen === "mobile" ? eq(wallpapers.isMobile, true) : screen === "tablet" ? eq(wallpapers.isMobile, false) : undefined;

/** Public wallpapers of a drop, in the admin's order (only this screen shape when given). */
export function listDropItems(dropId: string, screen: ScreenFilter | null) {
  return db
    .select({ ...itemFields, likeCount: wallpapers.likeCount, downloadCount: wallpapers.downloadCount, addedAt: collectionWallpapers.addedAt })
    .from(collectionWallpapers)
    .innerJoin(wallpapers, eq(collectionWallpapers.wallpaperId, wallpapers.id))
    .where(and(publicItems(dropId), screenWhere(screen)))
    .orderBy(asc(collectionWallpapers.sortOrder), asc(collectionWallpapers.addedAt));
}

/**
 * Banner art: the first 4 wallpapers plus the accent colour. With `screen` (the app) only that
 * shape is used, so a phone never gets cropped desktop art; without it (the website) phone
 * wallpapers come first because the banner's cards are portrait.
 */
async function bannerArt(dropId: string, screen: ScreenFilter | null) {
  const preview = await db
    .select(itemFields)
    .from(collectionWallpapers)
    .innerJoin(wallpapers, eq(collectionWallpapers.wallpaperId, wallpapers.id))
    .where(and(publicItems(dropId), screenWhere(screen)))
    .orderBy(
      ...(screen ? [] : [sql`${wallpapers.isMobile} desc`]),
      asc(collectionWallpapers.sortOrder),
      asc(collectionWallpapers.addedAt)
    )
    .limit(4);
  return { preview, accentColor: accentFrom(preview.map((p) => p.dominantColor)) };
}

async function publicCount(dropId: string, screen: ScreenFilter | null) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(collectionWallpapers)
    .innerJoin(wallpapers, eq(collectionWallpapers.wallpaperId, wallpapers.id))
    .where(and(publicItems(dropId), screenWhere(screen)));
  return row?.n ?? 0;
}

/**
 * The live drop to show as a home banner for `placement`, or null (none live, or it has nothing
 * for this screen). `screen` limits the count, the art and the drop page to that shape.
 */
export async function getSpotlight(placement: "app" | "web", screen: ScreenFilter | null) {
  const now = new Date();
  const [drop] = await db
    .select({
      id: collections.id,
      title: collections.title,
      description: collections.description,
      startsAt: collections.startsAt,
      endsAt: collections.endsAt,
    })
    .from(collections)
    .where(
      and(
        eq(collections.kind, "drop"),
        isNotNull(collections.publishedAt),
        or(isNull(collections.startsAt), lte(collections.startsAt, now)),
        or(isNull(collections.endsAt), gt(collections.endsAt, now)),
        eq(placement === "app" ? collections.showOnApp : collections.showOnWeb, true)
      )
    )
    .orderBy(sql`${collections.startsAt} desc nulls last`, sql`${collections.publishedAt} desc`)
    .limit(1);
  if (!drop) return null;

  const wallpaperCount = await publicCount(drop.id, screen);
  if (wallpaperCount === 0) return null;
  return { ...drop, wallpaperCount, ...(await bannerArt(drop.id, screen)) };
}

/** Drop details for the collection page (accent colour + status); null if it isn't public. */
export async function publicDropInfo(drop: { id: string } & DropTimes, screen: ScreenFilter | null) {
  if (!isDropPublic(drop)) return null;
  const { preview, accentColor } = await bannerArt(drop.id, screen);
  return { status: dropStatus(drop), startsAt: drop.startsAt, endsAt: drop.endsAt, accentColor, preview };
}

// ─── admin ──────────────────────────────────────────────────

async function findDrop(id: string) {
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.kind, "drop")))
    .limit(1);
  if (!row) throw new ApiError(404, "Drop not found");
  return row;
}

export async function adminListDrops() {
  const rows = await db
    .select({
      id: collections.id,
      title: collections.title,
      startsAt: collections.startsAt,
      endsAt: collections.endsAt,
      publishedAt: collections.publishedAt,
      showOnApp: collections.showOnApp,
      showOnWeb: collections.showOnWeb,
      createdAt: collections.createdAt,
      wallpaperCount: sql<number>`(select count(*)::int from ${collectionWallpapers} where ${collectionWallpapers.collectionId} = ${collections.id})`,
      coverThumbUrl: sql<string | null>`(
        select coalesce(w.cdn_variants -> 'thumb' ->> 'url', w.file_url)
        from collection_wallpapers cw join wallpapers w on w.id = cw.wallpaper_id
        where cw.collection_id = ${collections.id}
        order by cw.sort_order, cw.added_at limit 1
      )`,
    })
    .from(collections)
    .where(eq(collections.kind, "drop"))
    .orderBy(sql`${collections.startsAt} desc nulls first`, sql`${collections.createdAt} desc`);
  const now = new Date();
  return { data: rows.map((r) => ({ ...r, status: dropStatus(r, now) })) };
}

export async function adminGetDrop(id: string) {
  const drop = await findDrop(id);
  const items = await db
    .select({ ...itemFields, status: wallpapers.status, sortOrder: collectionWallpapers.sortOrder })
    .from(collectionWallpapers)
    .innerJoin(wallpapers, eq(collectionWallpapers.wallpaperId, wallpapers.id))
    .where(eq(collectionWallpapers.collectionId, id))
    .orderBy(asc(collectionWallpapers.sortOrder), asc(collectionWallpapers.addedAt));
  const portraitFirst = [...items.filter((i) => i.isMobile), ...items.filter((i) => !i.isMobile)];
  const approved = portraitFirst.filter((i) => i.status === "approved");
  return {
    drop: { ...drop, status: dropStatus(drop), accentColor: accentFrom(approved.slice(0, 4).map((i) => i.dominantColor)) },
    wallpapers: items,
  };
}

function checkWindow(startsAt: Date | null | undefined, endsAt: Date | null | undefined) {
  if (startsAt && endsAt && endsAt <= startsAt) throw new ApiError(400, "The end must be after the start.");
}

export async function adminCreateDrop(adminId: string, input: DropBodyInput) {
  checkWindow(input.startsAt, input.endsAt);
  const [row] = await db
    .insert(collections)
    .values({
      userId: adminId,
      kind: "drop",
      isPublic: true,
      title: input.title!,
      description: input.description ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      showOnApp: input.showOnApp ?? true,
      showOnWeb: input.showOnWeb ?? true,
      publishedAt: input.published ? new Date() : null,
    })
    .returning({ id: collections.id });
  await logAdminAction({ adminId, action: "drop.create", targetType: "collection", targetId: row!.id, details: { title: input.title } });
  return adminGetDrop(row!.id);
}

export async function adminUpdateDrop(adminId: string, id: string, input: DropBodyInput) {
  const drop = await findDrop(id);
  const startsAt = input.startsAt === undefined ? drop.startsAt : input.startsAt;
  const endsAt = input.endsAt === undefined ? drop.endsAt : input.endsAt;
  checkWindow(startsAt, endsAt);

  const updates: Partial<typeof collections.$inferInsert> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.startsAt !== undefined) updates.startsAt = input.startsAt;
  if (input.endsAt !== undefined) updates.endsAt = input.endsAt;
  if (input.showOnApp !== undefined) updates.showOnApp = input.showOnApp;
  if (input.showOnWeb !== undefined) updates.showOnWeb = input.showOnWeb;
  if (input.published !== undefined) updates.publishedAt = input.published ? (drop.publishedAt ?? new Date()) : null;
  if (Object.keys(updates).length) await db.update(collections).set(updates).where(eq(collections.id, id));

  await logAdminAction({ adminId, action: "drop.update", targetType: "collection", targetId: id, details: { fields: Object.keys(updates) } });
  return adminGetDrop(id);
}

export async function adminDeleteDrop(adminId: string, id: string) {
  const drop = await findDrop(id);
  await db.transaction(async (tx) => {
    await tx.delete(collectionWallpapers).where(eq(collectionWallpapers.collectionId, id));
    await tx.delete(collections).where(eq(collections.id, id));
    await logAdminAction({ adminId, action: "drop.delete", targetType: "collection", targetId: id, details: { title: drop.title } }, tx);
  });
  return { message: "Drop deleted" };
}

/** Replace the drop's wallpapers with `ids`, in that order (add, remove and reorder in one save). */
export async function adminSetDropItems(adminId: string, id: string, ids: string[]) {
  await findDrop(id);
  const unique = [...new Set(ids)];
  if (unique.length) {
    const found = await db
      .select({ id: wallpapers.id })
      .from(wallpapers)
      .where(inArray(wallpapers.id, unique));
    if (found.length !== unique.length) throw new ApiError(400, "Some wallpapers no longer exist. Reload and try again.");
  }
  await db.transaction(async (tx) => {
    await tx.delete(collectionWallpapers).where(eq(collectionWallpapers.collectionId, id));
    if (unique.length) {
      await tx.insert(collectionWallpapers).values(unique.map((wallpaperId, i) => ({ collectionId: id, wallpaperId, sortOrder: i })));
    }
    await tx.update(collections).set({ coverWallpaperId: unique[0] ?? null }).where(eq(collections.id, id));
    await logAdminAction({ adminId, action: "drop.items", targetType: "collection", targetId: id, details: { count: unique.length } }, tx);
  });
  return adminGetDrop(id);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Append one wallpaper to the end of a drop (bulk upload "Add to drop"). */
export async function appendToDrop(dropId: string, wallpaperId: string, tx: Tx) {
  const [row] = await tx
    .select({ next: sql<number>`coalesce(max(${collectionWallpapers.sortOrder}) + 1, 0)::int` })
    .from(collectionWallpapers)
    .where(eq(collectionWallpapers.collectionId, dropId));
  await tx
    .insert(collectionWallpapers)
    .values({ collectionId: dropId, wallpaperId, sortOrder: row?.next ?? 0 })
    .onConflictDoNothing();
  await tx
    .update(collections)
    .set({ coverWallpaperId: wallpaperId })
    .where(and(eq(collections.id, dropId), isNull(collections.coverWallpaperId)));
}

export { findDrop as assertDropExists };
