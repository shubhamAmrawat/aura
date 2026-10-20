import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db";
import { contentReports, users, wallpapers } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { thumbUrlSql } from "../wallpaperThumb.service";
import { deleteWallpaper } from "./wallpapers.service";
import { disableUser } from "./users.service";

const reporter = alias(users, "reporter");
const reported = alias(users, "reported");

type Status = "open" | "actioned" | "dismissed";

/** Reports newest first, with the reported wallpaper / user and how many open reports share the target. */
export async function list(status: Status, limit: number, offset: number) {
  const where = eq(contentReports.status, status);
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    db
      .select({
        id: contentReports.id,
        targetType: contentReports.targetType,
        targetLabel: contentReports.targetLabel,
        reason: contentReports.reason,
        details: contentReports.details,
        source: contentReports.source,
        status: contentReports.status,
        resolutionNote: contentReports.resolutionNote,
        resolvedAt: contentReports.resolvedAt,
        createdAt: contentReports.createdAt,
        wallpaper: {
          id: wallpapers.id,
          title: wallpapers.title,
          thumbUrl: thumbUrlSql,
          fileUrl: wallpapers.fileUrl,
          status: wallpapers.status,
        },
        reportedUser: {
          id: reported.id,
          username: reported.username,
          displayName: reported.displayName,
          avatarUrl: reported.avatarUrl,
          disabledAt: reported.disabledAt,
        },
        reporter: { id: reporter.id, username: reporter.username },
        /** Open reports on the same wallpaper (or the same user, for user reports) */
        openOnTarget: sql<number>`(
          SELECT count(*)::int FROM content_reports r2
          WHERE r2.status = 'open' AND r2.target_type = ${contentReports.targetType}
            AND (CASE WHEN ${contentReports.targetType} = 'wallpaper'
                      THEN r2.wallpaper_id = ${contentReports.wallpaperId}
                      ELSE r2.reported_user_id = ${contentReports.reportedUserId} END))`,
      })
      .from(contentReports)
      .leftJoin(wallpapers, eq(wallpapers.id, contentReports.wallpaperId))
      .leftJoin(reported, eq(reported.id, contentReports.reportedUserId))
      .leftJoin(reporter, eq(reporter.id, contentReports.reporterId))
      .where(where)
      .orderBy(desc(contentReports.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(contentReports).where(where),
  ]);
  // A left join with no match gives an object of nulls; turn those into null.
  const data = rows.map((r) => ({
    ...r,
    wallpaper: r.wallpaper?.id ? r.wallpaper : null,
    reportedUser: r.reportedUser?.id ? r.reportedUser : null,
    reporter: r.reporter?.id ? r.reporter : null,
  }));
  return { data, total };
}

/** { open, actioned, dismissed } — for the sidebar badge. */
export async function counts() {
  const rows = await db.select({ status: contentReports.status, n: sql<number>`count(*)::int` }).from(contentReports).groupBy(contentReports.status);
  const out = { open: 0, actioned: 0, dismissed: 0 };
  for (const r of rows) if (r.status in out) out[r.status as Status] = r.n;
  return out;
}

/**
 * Close a report, optionally deleting the wallpaper or disabling the user first.
 * Every other open report on the same target is closed with it.
 */
export async function resolve(
  adminId: string,
  id: string,
  input: { action: "none" | "delete_wallpaper" | "disable_user"; status: "actioned" | "dismissed"; note: string | null }
) {
  const [report] = await db.select().from(contentReports).where(eq(contentReports.id, id)).limit(1);
  if (!report) throw new ApiError(404, "Report not found");
  if (report.status !== "open") throw new ApiError(409, "This report is already closed.");

  // Every open report on the same target, found before any delete clears wallpaper_id.
  const sameTarget =
    report.targetType === "wallpaper"
      ? report.wallpaperId
        ? eq(contentReports.wallpaperId, report.wallpaperId)
        : eq(contentReports.id, report.id)
      : report.reportedUserId
        ? eq(contentReports.reportedUserId, report.reportedUserId)
        : eq(contentReports.id, report.id);
  // Disabling a user also settles the open reports about their wallpapers.
  const target =
    input.action === "disable_user" && report.reportedUserId
      ? or(sameTarget, eq(contentReports.reportedUserId, report.reportedUserId))!
      : and(eq(contentReports.targetType, report.targetType), sameTarget)!;
  const toClose = (await db.select({ id: contentReports.id }).from(contentReports).where(and(eq(contentReports.status, "open"), target))).map((r) => r.id);
  if (!toClose.includes(report.id)) toClose.push(report.id);

  if (input.action === "delete_wallpaper") {
    if (!report.wallpaperId) throw new ApiError(409, "That wallpaper no longer exists.");
    await deleteWallpaper(adminId, report.wallpaperId);
  } else if (input.action === "disable_user") {
    if (!report.reportedUserId) throw new ApiError(409, "This report has no user to disable.");
    await disableUser(adminId, report.reportedUserId, input.note ?? `Reported for ${report.reason}`);
  }

  const closed = await db
    .update(contentReports)
    .set({ status: input.status, resolvedBy: adminId, resolvedAt: new Date(), resolutionNote: input.note })
    .where(and(eq(contentReports.status, "open"), inArray(contentReports.id, toClose)))
    .returning({ id: contentReports.id });

  await logAdminAction({
    adminId,
    action: "report.resolve",
    targetType: "report",
    targetId: id,
    details: { action: input.action, status: input.status, reason: report.reason, target: report.targetLabel, closed: closed.length },
  });
  return { id, status: input.status, action: input.action, closedIds: closed.map((c) => c.id) };
}
