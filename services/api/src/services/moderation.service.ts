import { and, desc, eq } from "drizzle-orm";
import { db } from "../config/db";
import { contentReports, userBlocks, users, wallpapers, type ReportReason } from "../models";
import { ApiError } from "../utils/ApiError";
import type { ClientSource } from "./wallpaper.service";

// ─── Reports ─────────────────────────────────────────────

const REPORTS_PER_HOUR = 10;
const reportCounts = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of reportCounts) if (now > v.resetAt) reportCounts.delete(k);
}, 10 * 60_000).unref();

/** At most 10 reports an hour per account (or per IP for guests). */
function takeReportSlot(key: string) {
  const now = Date.now();
  const rec = reportCounts.get(key);
  if (!rec || now > rec.resetAt) {
    reportCounts.set(key, { count: 1, resetAt: now + 3600_000 });
    return;
  }
  if (rec.count >= REPORTS_PER_HOUR) throw new ApiError(429, "You've sent a lot of reports. Try again later.");
  rec.count++;
}

export async function createReport(input: {
  reporterId: string | null;
  clientKey: string;
  targetType: "wallpaper" | "user";
  targetId: string;
  reason: ReportReason;
  details: string | null;
  source: ClientSource;
}) {
  let wallpaperId: string | null = null;
  let reportedUserId: string | null = null;
  let targetLabel: string | null = null;

  if (input.targetType === "wallpaper") {
    const [w] = await db
      .select({ id: wallpapers.id, title: wallpapers.title, uploaderId: wallpapers.uploaderId, role: users.role })
      .from(wallpapers)
      .leftJoin(users, eq(users.id, wallpapers.uploaderId))
      .where(eq(wallpapers.id, input.targetId))
      .limit(1);
    if (!w) throw new ApiError(404, "Wallpaper not found");
    wallpaperId = w.id;
    reportedUserId = w.uploaderId && w.role !== "admin" ? w.uploaderId : null;
    targetLabel = w.title;
  } else {
    const [u] = await db.select({ id: users.id, username: users.username, role: users.role }).from(users).where(eq(users.id, input.targetId)).limit(1);
    if (!u || u.role === "admin") throw new ApiError(404, "User not found");
    if (u.id === input.reporterId) throw new ApiError(400, "You can't report yourself.");
    reportedUserId = u.id;
    targetLabel = `@${u.username}`;
  }

  // The same person reporting the same thing again while it's still open: nothing new to add.
  if (input.reporterId) {
    const [open] = await db
      .select({ id: contentReports.id })
      .from(contentReports)
      .where(
        and(
          eq(contentReports.reporterId, input.reporterId),
          eq(contentReports.targetType, input.targetType),
          eq(contentReports.status, "open"),
          input.targetType === "wallpaper" ? eq(contentReports.wallpaperId, wallpaperId!) : eq(contentReports.reportedUserId, reportedUserId!)
        )
      )
      .limit(1);
    if (open) return { id: open.id };
  }

  takeReportSlot(input.reporterId ? `u:${input.reporterId}` : `ip:${input.clientKey}`);
  const [row] = await db
    .insert(contentReports)
    .values({
      reporterId: input.reporterId,
      targetType: input.targetType,
      wallpaperId,
      reportedUserId,
      targetLabel,
      reason: input.reason,
      details: input.details,
      source: input.source,
    })
    .returning({ id: contentReports.id });
  return { id: row!.id };
}

// ─── Blocks ──────────────────────────────────────────────

export function listBlocks(userId: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      blockedAt: userBlocks.createdAt,
    })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, userId))
    .orderBy(desc(userBlocks.createdAt));
}

export async function blockUser(userId: string, targetId: string) {
  if (userId === targetId) throw new ApiError(400, "You can't block yourself.");
  const [u] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, targetId)).limit(1);
  if (!u || u.role === "admin") throw new ApiError(404, "User not found");
  await db.insert(userBlocks).values({ blockerId: userId, blockedId: targetId }).onConflictDoNothing();
  return { blocked: true as const };
}

export async function unblockUser(userId: string, targetId: string) {
  await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, targetId)));
  return { blocked: false as const };
}
