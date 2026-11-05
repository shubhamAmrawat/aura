import { sql } from "drizzle-orm";
import { db } from "../config/db";
import type { Client } from "./client";

/** Write at most once per user (and app / website) per 5 minutes (per API instance), so busy sessions cost ~nothing. */
const THROTTLE_MS = 5 * 60_000;
const lastWrite = new Map<string, number>();

/**
 * Record that a signed-in user is using the website or app (Admin › Users › Last active, and
 * "Where they use Aurora"). Fire-and-forget: never delays or fails the request.
 */
export function touchLastActive(userId: string, client: Client | null = null, agent: string | null = null) {
  const now = Date.now();
  const key = `${userId}:${client ?? "-"}`;
  const prev = lastWrite.get(key);
  if (prev && now - prev < THROTTLE_MS) return;
  if (lastWrite.size > 10_000) lastWrite.clear();
  lastWrite.set(key, now);
  const q =
    client === "app"
      ? sql`UPDATE users SET last_active_at = now(), last_app_at = now(), first_app_at = coalesce(first_app_at, now())
            WHERE id = ${userId} AND (last_app_at IS NULL OR last_app_at < now() - interval '5 minutes')`
      : client === "web"
        ? sql`UPDATE users SET last_active_at = now(), last_web_at = now(), first_web_at = coalesce(first_web_at, now()),
                last_web_agent = coalesce(${agent}::text, last_web_agent)
              WHERE id = ${userId} AND (last_web_at IS NULL OR last_web_at < now() - interval '5 minutes')`
        : sql`UPDATE users SET last_active_at = now()
              WHERE id = ${userId} AND (last_active_at IS NULL OR last_active_at < now() - interval '5 minutes')`;
  db.execute(q).catch(() => {
    lastWrite.delete(key); // try again on the next request
  });
}
