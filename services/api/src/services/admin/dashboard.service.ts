import { sql } from "drizzle-orm";
import { db } from "../../config/db";
import { REJECTED_RETENTION_DAYS } from "./review.service";

/** Days are counted in India time (timestamps are stored as UTC). */
const TZ = "Asia/Kolkata";
const localDate = (col: string) => sql.raw(`((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')::date`);
const today = sql.raw(`(now() AT TIME ZONE '${TZ}')::date`);
const SPARK_DAYS = 14;

const n = (v: unknown) => Number(v ?? 0);
type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as Row[];

export type DashboardDay = { day: string; downloads: number; views: number; likes: number; signups: number; uploads: number };

/** Everything the admin Overview page shows, for the last `days` days. */
export async function getDashboard(days: 7 | 30 | 90) {
  const span = Math.max(days, SPARK_DAYS);

  const [seriesRows, totalsRows, attentionRows, categoryRows, topDownloads, topLikes, topViews, platformRows, recentRows] =
    await Promise.all([
      // One row per day: activity counts (missing days = 0)
      rows(sql`
        WITH d AS (SELECT generate_series(${today} - ${span - 1}::int, ${today}, interval '1 day')::date AS day)
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
          coalesce(dl.c, 0) AS downloads, coalesce(v.c, 0) AS views, coalesce(l.c, 0) AS likes,
          coalesce(s.c, 0) AS signups, coalesce(u.c, 0) AS uploads
        FROM d
        LEFT JOIN (SELECT ${localDate("created_at")} AS day, count(*) AS c FROM downloads GROUP BY 1) dl ON dl.day = d.day
        LEFT JOIN (SELECT day, sum(views) AS c FROM wallpaper_views_daily GROUP BY 1) v ON v.day = d.day
        LEFT JOIN (SELECT ${localDate("created_at")} AS day, count(*) AS c FROM likes GROUP BY 1) l ON l.day = d.day
        LEFT JOIN (SELECT ${localDate("created_at")} AS day, count(*) AS c FROM users WHERE role = 'user' GROUP BY 1) s ON s.day = d.day
        LEFT JOIN (SELECT ${localDate("created_at")} AS day, count(*) AS c FROM wallpapers GROUP BY 1) u ON u.day = d.day
        ORDER BY d.day`),
      rows(sql`
        SELECT
          (SELECT count(*) FROM wallpapers WHERE status = 'approved') AS live,
          (SELECT count(*) FROM users WHERE role = 'user') AS users,
          (SELECT count(*) FROM users WHERE role = 'user' AND is_creator) AS creators,
          (SELECT count(*) FROM wallpapers WHERE status = 'pending') AS pending,
          (SELECT count(*) FROM likes) AS likes_all,
          (SELECT coalesce(sum(download_count), 0) FROM wallpapers) AS downloads_all,
          (SELECT coalesce(sum(view_count), 0) FROM wallpapers) AS views_all`),
      rows(sql`
        SELECT
          (SELECT count(*) FROM wallpapers WHERE status = 'pending') AS pending,
          (SELECT min(created_at) FROM wallpapers WHERE status = 'pending') AS oldest_pending,
          (SELECT count(*) FROM wallpapers WHERE status = 'rejected'
             AND rejected_at < now() - make_interval(days => ${REJECTED_RETENTION_DAYS - 7})) AS expiring,
          (SELECT count(*) FROM wallpapers WHERE status = 'rejected') AS rejected,
          (SELECT coalesce(sum(file_size_bytes), 0) FROM wallpapers) AS storage_bytes`),
      rows(sql`
        SELECT c.id, c.name,
          count(DISTINCT w.id) FILTER (WHERE w.status = 'approved') AS wallpapers,
          count(dl.id) AS downloads
        FROM categories c
        LEFT JOIN wallpapers w ON w.category_id = c.id
        LEFT JOIN downloads dl ON dl.wallpaper_id = w.id AND ${localDate("dl.created_at")} > ${today} - ${days}::int
        GROUP BY c.id, c.name, c.sort_order
        ORDER BY wallpapers DESC, c.sort_order`),
      rows(sql`
        SELECT w.id, w.title, w.file_url, w.dominant_color, count(*) AS c FROM downloads dl
        JOIN wallpapers w ON w.id = dl.wallpaper_id
        WHERE ${localDate("dl.created_at")} > ${today} - ${days}::int
        GROUP BY w.id ORDER BY c DESC, w.title LIMIT 8`),
      rows(sql`
        SELECT w.id, w.title, w.file_url, w.dominant_color, count(*) AS c FROM likes l
        JOIN wallpapers w ON w.id = l.wallpaper_id
        WHERE ${localDate("l.created_at")} > ${today} - ${days}::int
        GROUP BY w.id ORDER BY c DESC, w.title LIMIT 8`),
      rows(sql`
        SELECT w.id, w.title, w.file_url, w.dominant_color, sum(v.views) AS c FROM wallpaper_views_daily v
        JOIN wallpapers w ON w.id = v.wallpaper_id
        WHERE v.day > ${today} - ${days}::int
        GROUP BY w.id ORDER BY c DESC, w.title LIMIT 8`),
      rows(sql`
        SELECT 'downloads' AS metric, source, count(*) AS c FROM downloads
        WHERE ${localDate("created_at")} > ${today} - ${days}::int GROUP BY source
        UNION ALL
        SELECT 'views', source, sum(views) FROM wallpaper_views_daily
        WHERE day > ${today} - ${days}::int GROUP BY source`),
      rows(sql`
        (SELECT 'signup' AS kind, u.created_at AS at, u.username AS who, NULL::text AS what, NULL::text AS ref
           FROM users u WHERE u.role = 'user' ORDER BY u.created_at DESC LIMIT 12)
        UNION ALL
        (SELECT 'upload', w.created_at, u.username, w.title, w.status::text
           FROM wallpapers w JOIN users u ON u.id = w.uploader_id ORDER BY w.created_at DESC LIMIT 12)
        UNION ALL
        (SELECT 'admin', a.created_at, coalesce(u.username, 'system'), a.action, a.details->>'title'
           FROM admin_actions a LEFT JOIN users u ON u.id = a.admin_id ORDER BY a.created_at DESC LIMIT 12)
        ORDER BY at DESC LIMIT 12`),
    ]);

  const allDays: DashboardDay[] = seriesRows.map((r) => ({
    day: String(r.day),
    downloads: n(r.downloads),
    views: n(r.views),
    likes: n(r.likes),
    signups: n(r.signups),
    uploads: n(r.uploads),
  }));
  const series = allDays.slice(-days);
  const last14 = allDays.slice(-SPARK_DAYS);

  const kpi = (key: keyof Omit<DashboardDay, "day">) => {
    const vals = last14.map((d) => d[key]);
    const current = vals.slice(-7).reduce((a, b) => a + b, 0);
    const previous = vals.slice(0, 7).reduce((a, b) => a + b, 0);
    return { last7d: current, prev7d: previous, spark: vals };
  };

  const t = totalsRows[0]!;
  const a = attentionRows[0]!;
  const platform = { downloads: { web: 0, mobile: 0, unknown: 0 }, views: { web: 0, mobile: 0, unknown: 0 } };
  for (const r of platformRows) {
    const metric = r.metric as "downloads" | "views";
    const src = (["web", "mobile"].includes(String(r.source)) ? r.source : "unknown") as "web" | "mobile" | "unknown";
    platform[metric][src] += n(r.c);
  }
  const top = (list: Row[]) =>
    list.map((r) => ({ id: String(r.id), title: String(r.title), fileUrl: String(r.file_url), dominantColor: String(r.dominant_color), count: n(r.c) }));

  return {
    days,
    timezone: TZ,
    totals: {
      liveWallpapers: n(t.live),
      users: n(t.users),
      creators: n(t.creators),
      pending: n(t.pending),
      downloads: n(t.downloads_all),
      views: n(t.views_all),
      likes: n(t.likes_all),
    },
    kpis: { downloads: kpi("downloads"), views: kpi("views"), likes: kpi("likes"), signups: kpi("signups"), uploads: kpi("uploads") },
    series,
    attention: {
      pending: n(a.pending),
      oldestPendingAt: a.oldest_pending ? new Date(a.oldest_pending as string).toISOString() : null,
      rejected: n(a.rejected),
      rejectedExpiringSoon: n(a.expiring),
      storageBytes: n(a.storage_bytes),
    },
    categories: categoryRows.map((r) => ({ id: String(r.id), name: String(r.name), wallpapers: n(r.wallpapers), downloads: n(r.downloads) })),
    top: { downloads: top(topDownloads), likes: top(topLikes), views: top(topViews) },
    platform,
    recent: recentRows.map((r) => ({
      kind: r.kind as "signup" | "upload" | "admin",
      at: new Date(r.at as string).toISOString(),
      who: String(r.who),
      what: r.what === null ? null : String(r.what),
      ref: r.ref === null ? null : String(r.ref),
    })),
    generatedAt: new Date().toISOString(),
  };
}
