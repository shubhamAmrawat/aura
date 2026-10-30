import { sql } from "drizzle-orm";

const CREATOR_ID_EXPR = `(SELECT u.id FROM "users" u WHERE u.id = "wallpapers"."uploader_id" AND u.role <> 'admin')`;

/**
 * The uploader's id when a creator (not an admin) uploaded the wallpaper, else null.
 * Feeds return it so the app can hide wallpapers from creators the user blocked
 * (feeds are cached publicly, so that filtering happens on the device).
 */
export const creatorIdSql = sql<string | null>`${sql.raw(CREATOR_ID_EXPR)}`;

/** The creator's @username (null for admin uploads), shown as "by @…" on featured wallpapers. */
export const creatorUsernameSql = sql<string | null>`(SELECT u.username FROM "users" u WHERE u.id = "wallpapers"."uploader_id" AND u.role <> 'admin')`;

/** Same, for hand-written SELECTs on `wallpapers` that return snake_case rows. */
export const creatorIdColumnSql = sql.raw(`${CREATOR_ID_EXPR} AS creator_id`);
