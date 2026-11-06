import { and, desc, eq, gte, ilike, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/db";
import { categories, downloads, users, wallpapers } from "../../models";
import { thumbUrlSql } from "../wallpaperThumb.service";
import { startOfIstDay } from "../notify/rules";

/** Admin › Downloads: totals, a per-day (or per-hour) chart, most downloaded, and the latest downloads. */

export type DownloadRange = "today" | "7d" | "30d" | "90d";
export type DownloadSource = "all" | "app" | "web";

const DAY = 86_400_000;
/** downloads.source values: the app reports "mobile", the website "web". */
const SOURCE_COL: Record<Exclude<DownloadSource, "all">, string> = { app: "mobile", web: "web" };
const sourceWhere = (s: DownloadSource): SQL | undefined => (s === "all" ? undefined : eq(downloads.source, SOURCE_COL[s]));

function rangeStart(range: DownloadRange, now = new Date()) {
  const today = startOfIstDay(now);
  return range === "today" ? today : new Date(today.getTime() - ({ "7d": 6, "30d": 29, "90d": 89 }[range]) * DAY);
}

type Split = { total: number; app: number; web: number };
async function countBetween(from: Date | null, to: Date | null, source: DownloadSource): Promise<Split> {
  const [r] = await db
    .select({
      total: sql<number>`count(*)::int`,
      app: sql<number>`count(*) filter (where ${downloads.source} = 'mobile')::int`,
      web: sql<number>`count(*) filter (where ${downloads.source} = 'web')::int`,
    })
    .from(downloads)
    .where(and(from ? gte(downloads.createdAt, from) : undefined, to ? lt(downloads.createdAt, to) : undefined, sourceWhere(source)));
  return r ?? { total: 0, app: 0, web: 0 };
}

export async function downloadsOverview(range: DownloadRange, source: DownloadSource) {
  const now = new Date();
  const today = startOfIstDay(now);
  const ago = (days: number) => new Date(today.getTime() - days * DAY);

  // totals: each with the period before it (today vs yesterday, 7 days vs the 7 before, …)
  const [t, y, w, wPrev, m, mPrev, all, first] = await Promise.all([
    countBetween(today, null, source),
    countBetween(ago(1), today, source),
    countBetween(ago(6), null, source),
    countBetween(ago(13), ago(6), source),
    countBetween(ago(29), null, source),
    countBetween(ago(59), ago(29), source),
    countBetween(null, null, source),
    db.select({ at: sql<string | null>`to_char(min(${downloads.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')` }).from(downloads),
  ]);
  const change = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
  const totals = {
    today: { ...t, change: change(t.total, y.total) },
    week: { ...w, change: change(w.total, wPrev.total) },
    month: { ...m, change: change(m.total, mPrev.total) },
    all: { ...all, since: first[0]?.at ?? null },
  };

  // chart: hours for today, India days otherwise (empty buckets filled in)
  const from = rangeStart(range, now);
  const ist = sql`((${downloads.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')`;
  const bucket = range === "today" ? sql`to_char(${ist}, 'HH24')` : sql`to_char(${ist}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      bucket: sql<string>`${bucket}`,
      app: sql<number>`count(*) filter (where ${downloads.source} = 'mobile')::int`,
      web: sql<number>`count(*) filter (where ${downloads.source} = 'web')::int`,
      other: sql<number>`count(*) filter (where ${downloads.source} not in ('mobile', 'web'))::int`,
    })
    .from(downloads)
    .where(and(gte(downloads.createdAt, from), sourceWhere(source)))
    .groupBy(sql`1`);
  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const keys =
    range === "today"
      ? Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"))
      : Array.from({ length: Math.round((today.getTime() - from.getTime()) / DAY) + 1 }, (_, i) => istDay(new Date(from.getTime() + i * DAY)));
  const chart = keys.map((k) => {
    const r = byKey.get(k);
    return { key: k, app: r?.app ?? 0, web: r?.web ?? 0, other: r?.other ?? 0 };
  });

  // most downloaded in the range
  const n = sql<number>`count(*)::int`;
  const top = await db
    .select({
      id: wallpapers.id,
      title: wallpapers.title,
      thumbUrl: thumbUrlSql,
      fileUrl: wallpapers.fileUrl,
      isMobile: wallpapers.isMobile,
      category: categories.name,
      count: n,
    })
    .from(downloads)
    .innerJoin(wallpapers, eq(wallpapers.id, downloads.wallpaperId))
    .leftJoin(categories, eq(categories.id, wallpapers.categoryId))
    .where(and(gte(downloads.createdAt, from), sourceWhere(source)))
    .groupBy(wallpapers.id, categories.name)
    .orderBy(desc(n))
    .limit(8);

  return { range, source, totals, chart, top };
}

export async function recentDownloads(f: { source: DownloadSource; signedIn: boolean; q?: string; limit: number; offset: number }) {
  const where: (SQL | undefined)[] = [sourceWhere(f.source), f.signedIn ? isNotNull(downloads.userId) : undefined];
  if (f.q) {
    const p = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(wallpapers.title, p), ilike(users.username, p), ilike(users.displayName, p), ilike(users.email, p)));
  }
  const rows = await db
    .select({
      id: downloads.id,
      at: sql<string>`to_char(${downloads.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      source: downloads.source,
      quality: downloads.quality,
      wallpaperId: wallpapers.id,
      title: wallpapers.title,
      thumbUrl: thumbUrlSql,
      fileUrl: wallpapers.fileUrl,
      isMobile: wallpapers.isMobile,
      category: categories.name,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(downloads)
    .innerJoin(wallpapers, eq(wallpapers.id, downloads.wallpaperId))
    .leftJoin(categories, eq(categories.id, wallpapers.categoryId))
    .leftJoin(users, eq(users.id, downloads.userId))
    .where(and(...where))
    .orderBy(desc(downloads.createdAt))
    .limit(f.limit + 1)
    .offset(f.offset);
  return { data: rows.slice(0, f.limit), hasMore: rows.length > f.limit };
}
