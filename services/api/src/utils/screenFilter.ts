import { sql } from "drizzle-orm";
import { ApiError } from "./ApiError";

export type ScreenFilter = "mobile" | "tablet";

const SCREEN_ERROR = "Invalid screen value. Use 'mobile' or 'tablet'.";

/**
 * Parse `?screen=`: undefined/empty → null, "mobile"/"tablet" (any case) → value,
 * anything else → 400.
 */
export function parseScreenFilter(raw: string | undefined): ScreenFilter | null {
  const screen = raw?.trim().toLowerCase();
  if (!screen) return null;
  if (screen === "mobile" || screen === "tablet") return screen;
  throw new ApiError(400, SCREEN_ERROR);
}

/** Raw-SQL fragment for the screen filter (used inside db.execute queries). */
export function screenFilterSql(filter: ScreenFilter | null) {
  if (filter === "mobile") return sql`AND is_mobile = true`;
  if (filter === "tablet") return sql`AND is_mobile = false`;
  return sql``;
}
