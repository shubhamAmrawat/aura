import { sql } from "drizzle-orm";
import { db } from "../../config/db";

const n = (v: unknown) => Number(v ?? 0);

/** Numbers for the admin Overview page (totals + last 7 / 30 days). */
export async function getOverview() {
  const [usersRow, wallpapersRow, downloadsRow, likesRow] = await Promise.all([
    db.execute(sql`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE created_at > now() - interval '7 days')  AS new_7d,
             count(*) FILTER (WHERE created_at > now() - interval '30 days') AS new_30d,
             count(*) FILTER (WHERE is_creator) AS creators,
             count(*) FILTER (WHERE role = 'admin') AS admins
      FROM users`),
    db.execute(sql`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE status = 'approved') AS approved,
             count(*) FILTER (WHERE status = 'pending')  AS pending,
             count(*) FILTER (WHERE status = 'rejected') AS rejected,
             count(*) FILTER (WHERE is_featured) AS featured,
             count(*) FILTER (WHERE created_at > now() - interval '7 days')  AS new_7d,
             count(*) FILTER (WHERE created_at > now() - interval '30 days') AS new_30d,
             coalesce(sum(file_size_bytes), 0) AS storage_bytes,
             coalesce(sum(view_count), 0) AS views,
             coalesce(sum(download_count), 0) AS downloads_counter
      FROM wallpapers`),
    db.execute(sql`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE created_at > now() - interval '7 days')  AS last_7d,
             count(*) FILTER (WHERE created_at > now() - interval '30 days') AS last_30d
      FROM downloads`),
    db.execute(sql`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE created_at > now() - interval '7 days')  AS last_7d,
             count(*) FILTER (WHERE created_at > now() - interval '30 days') AS last_30d
      FROM likes`),
  ]);

  const u = usersRow[0]!;
  const w = wallpapersRow[0]!;
  const d = downloadsRow[0]!;
  const l = likesRow[0]!;

  return {
    users: { total: n(u.total), new7d: n(u.new_7d), new30d: n(u.new_30d), creators: n(u.creators), admins: n(u.admins) },
    wallpapers: {
      total: n(w.total),
      approved: n(w.approved),
      pending: n(w.pending),
      rejected: n(w.rejected),
      featured: n(w.featured),
      new7d: n(w.new_7d),
      new30d: n(w.new_30d),
      storageBytes: n(w.storage_bytes),
    },
    // `total` = all-time counter on wallpapers; 7d/30d come from the downloads log
    downloads: { total: n(w.downloads_counter), logged: n(d.total), last7d: n(d.last_7d), last30d: n(d.last_30d) },
    views: { total: n(w.views) },
    likes: { total: n(l.total), last7d: n(l.last_7d), last30d: n(l.last_30d) },
    generatedAt: new Date().toISOString(),
  };
}
