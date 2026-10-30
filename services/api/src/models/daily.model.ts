import { pgTable, uuid, text, timestamp, date, integer, primaryKey, unique } from "drizzle-orm/pg-core";
import { wallpapers } from "./wallpaper.model";

/** Wallpaper of the day, per screen shape (see scripts/migrations/2026-10-30-daily-wallpaper.sql). */
export const dailyWallpapers = pgTable(
  "daily_wallpapers",
  {
    /** Calendar day in Asia/Kolkata */
    day: date("day").notNull(),
    /** "mobile" | "tablet" */
    screen: text("screen").notNull(),
    wallpaperId: uuid("wallpaper_id").notNull().references(() => wallpapers.id, { onDelete: "cascade" }),
    /** Each wallpaper is picked at most once per cycle; a new cycle starts when all have had a day. */
    cycle: integer("cycle").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.screen] }), unique().on(t.screen, t.cycle, t.wallpaperId)]
);
