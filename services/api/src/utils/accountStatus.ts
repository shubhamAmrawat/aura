import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { users } from "../models";

export type AccountStatus = "active" | "disabled" | "missing";

// Checked on every authenticated request, so cache briefly. Disabling / enabling / deleting
// clears the entry, so on this instance the change applies to the very next request.
const TTL_MS = 30_000;
const cache = new Map<string, { status: AccountStatus; at: number }>();

export async function accountStatus(userId: string): Promise<AccountStatus> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.status;
  const [row] = await db.select({ disabledAt: users.disabledAt }).from(users).where(eq(users.id, userId)).limit(1);
  const status: AccountStatus = !row ? "missing" : row.disabledAt ? "disabled" : "active";
  if (cache.size > 10_000) cache.clear();
  cache.set(userId, { status, at: Date.now() });
  return status;
}

export function forgetAccountStatus(userId: string) {
  cache.delete(userId);
}

export const ACCOUNT_DISABLED_MESSAGE = "This account has been disabled. Contact support.";
