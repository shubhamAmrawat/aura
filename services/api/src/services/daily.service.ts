import { and, eq, sql } from "drizzle-orm";
import { db } from "../config/db";
import { dailyWallpapers, wallpapers } from "../models";
import { visibleCategorySql, visibleCategoryFilterSql, type ScreenFilter } from "../utils/screenFilter";
import { thumbUrlSql } from "./wallpaperThumb.service";
import { creatorIdSql, creatorUsernameSql } from "../utils/creatorId";

const TIME_ZONE = "Asia/Kolkata";

/** Today's date (YYYY-MM-DD) in India, where the day changes for everyone at the same moment. */
export function todayInIndia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const columns = {
  id: wallpapers.id,
  title: wallpapers.title,
  fileUrl: wallpapers.fileUrl,
  thumbUrl: thumbUrlSql,
  blurhash: wallpapers.blurhash,
  dominantColor: wallpapers.dominantColor,
  palette: wallpapers.palette,
  width: wallpapers.width,
  height: wallpapers.height,
  likeCount: wallpapers.likeCount,
  downloadCount: wallpapers.downloadCount,
  isMobile: wallpapers.isMobile,
  tags: wallpapers.tags,
  categoryId: wallpapers.categoryId,
  categoryName: sql<string | null>`(SELECT "categories"."name" FROM "categories" WHERE "categories"."id" = "wallpapers"."category_id")`,
  format: wallpapers.format,
  createdAt: wallpapers.createdAt,
  creatorId: creatorIdSql,
  creatorUsername: creatorUsernameSql,
};

async function todaysPickId(day: string, screen: ScreenFilter): Promise<string | null> {
  const [row] = await db
    .select({ id: dailyWallpapers.wallpaperId })
    .from(dailyWallpapers)
    .where(and(eq(dailyWallpapers.day, day), eq(dailyWallpapers.screen, screen)));
  return row?.id ?? null;
}

/**
 * Picks today's wallpaper: random, approved, the right shape, in a visible category, not yet
 * picked in this cycle (and not yesterday's). Safe if two requests race: the first insert wins
 * and both return the stored pick.
 */
async function pickToday(day: string, screen: ScreenFilter): Promise<string | null> {
  const isMobile = screen === "mobile";
  const cycleRows = (await db.execute(sql`
    SELECT COALESCE(MAX(cycle), 1)::int AS cycle FROM daily_wallpapers WHERE screen = ${screen}
  `)) as unknown as { cycle: number }[];
  const current = Number(cycleRows[0]?.cycle ?? 1);

  for (const cycle of [current, current + 1]) {
    const rows = (await db.execute(sql`
      SELECT id FROM wallpapers
      WHERE status = 'approved'
        AND is_mobile = ${isMobile}
        ${visibleCategoryFilterSql}
        AND id NOT IN (SELECT wallpaper_id FROM daily_wallpapers WHERE screen = ${screen} AND cycle = ${cycle})
        AND id NOT IN (SELECT wallpaper_id FROM daily_wallpapers WHERE screen = ${screen} AND day = ${day}::date - 1)
      ORDER BY random()
      LIMIT 1
    `)) as unknown as { id: string }[];
    const id = rows[0]?.id;
    if (!id) continue; // every wallpaper has had its day in this cycle: start the next one
    await db.execute(sql`
      INSERT INTO daily_wallpapers (day, screen, wallpaper_id, cycle)
      VALUES (${day}::date, ${screen}, ${id}::uuid, ${cycle})
      ON CONFLICT DO NOTHING
    `);
    return todaysPickId(day, screen);
  }
  return null; // no eligible wallpapers at all
}

async function loadVisible(id: string) {
  const [w] = await db
    .select(columns)
    .from(wallpapers)
    .where(and(eq(wallpapers.id, id), eq(wallpapers.status, "approved"), visibleCategorySql));
  return w ?? null;
}

/** GET /api/wallpapers/daily — the same wallpaper for everyone today (per screen shape). */
export async function getDailyWallpaper(screen: ScreenFilter) {
  const day = todayInIndia();
  let id = (await todaysPickId(day, screen)) ?? (await pickToday(day, screen));
  let wallpaper = id ? await loadVisible(id) : null;
  if (id && !wallpaper) {
    // Picked earlier today but since rejected or hidden: choose again.
    await db.delete(dailyWallpapers).where(and(eq(dailyWallpapers.day, day), eq(dailyWallpapers.screen, screen)));
    id = await pickToday(day, screen);
    wallpaper = id ? await loadVisible(id) : null;
  }
  return { day, wallpaper };
}
