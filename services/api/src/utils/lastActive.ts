import { sql } from "drizzle-orm";
import { db } from "../config/db";

/** Write at most once per user per 5 minutes (per API instance), so busy sessions cost ~nothing. */
const THROTTLE_MS = 5 * 60_000;
const lastWrite = new Map<string, number>();

/**
 * Record that a signed-in user is using the website or app (Admin › Users › Last active).
 * Fire-and-forget: never delays or fails the request.
 */
export function touchLastActive(userId: string) {
  const now = Date.now();
  const prev = lastWrite.get(userId);
  if (prev && now - prev < THROTTLE_MS) return;
  if (lastWrite.size > 10_000) lastWrite.clear();
  lastWrite.set(userId, now);
  db.execute(
    sql`UPDATE users SET last_active_at = now()
        WHERE id = ${userId} AND (last_active_at IS NULL OR last_active_at < now() - interval '5 minutes')`
  ).catch(() => {
    lastWrite.delete(userId); // try again on the next request
  });
}
