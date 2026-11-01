import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { siteSettings } from "../models";
import { ApiError } from "../utils/ApiError";
import { logAdminAction } from "../utils/audit";

/**
 * App versions set by an admin (admin › Notifications):
 *  latest = newest version on Play (the app suggests updating when it's older),
 *  min    = oldest version allowed (older apps must update before they can be used).
 */
const KEY = "app.versions";
export type AppVersions = { latest: string | null; min: string | null };

const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,4}$/;

export async function getAppVersions(): Promise<AppVersions> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, KEY)).limit(1);
  const v = (row?.value ?? {}) as Partial<AppVersions>;
  return { latest: typeof v.latest === "string" ? v.latest : null, min: typeof v.min === "string" ? v.min : null };
}

export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export async function setAppVersions(adminId: string, input: AppVersions) {
  for (const v of [input.latest, input.min]) if (v !== null && !VERSION.test(v)) throw new ApiError(400, "Versions look like 1.0.2");
  if (input.latest && input.min && compareVersions(input.min, input.latest) > 0) throw new ApiError(400, "The minimum can't be newer than the latest.");
  const value = { latest: input.latest, min: input.min };
  await db
    .insert(siteSettings)
    .values({ key: KEY, value, updatedAt: new Date(), updatedBy: adminId })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date(), updatedBy: adminId } });
  await logAdminAction({ adminId, action: "app.versions", targetType: "settings", targetId: KEY, details: value });
  return getAppVersions();
}
