import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { categories, users, wallpapers } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { generateWallpaperTextEmbedding } from "../../integrations/openai";
import { removeWallpaper } from "../wallpaperRemoval.service";
import { thumbUrlSql } from "../wallpaperThumb.service";

/** Rejected uploads are kept this long (so a mistake can be undone), then purged. */
export const REJECTED_RETENTION_DAYS = 30;

type ReviewStatus = "pending" | "rejected";

/** Pending: oldest first (fair queue). Rejected: most recently rejected first. */
export async function listForReview(status: ReviewStatus, limit: number, offset: number) {
  const rows = await db
    .select({
      id: wallpapers.id,
      title: wallpapers.title,
      description: wallpapers.description,
      fileUrl: wallpapers.fileUrl,
      thumbUrl: thumbUrlSql,
      blurhash: wallpapers.blurhash,
      dominantColor: wallpapers.dominantColor,
      width: wallpapers.width,
      height: wallpapers.height,
      fileSizeBytes: wallpapers.fileSizeBytes,
      format: wallpapers.format,
      tags: wallpapers.tags,
      isMobile: wallpapers.isMobile,
      isAiGenerated: wallpapers.isAiGenerated,
      status: wallpapers.status,
      moderationReason: wallpapers.moderationReason,
      reviewNote: wallpapers.reviewNote,
      reviewedAt: wallpapers.reviewedAt,
      rejectedAt: wallpapers.rejectedAt,
      createdAt: wallpapers.createdAt,
      category: { id: categories.id, name: categories.name },
      uploader: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(wallpapers)
    .leftJoin(categories, eq(categories.id, wallpapers.categoryId))
    .leftJoin(users, eq(users.id, wallpapers.uploaderId))
    .where(eq(wallpapers.status, status))
    .orderBy(status === "pending" ? asc(wallpapers.createdAt) : desc(wallpapers.rejectedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = (await db.execute(
    sql`SELECT count(*)::int AS total FROM wallpapers WHERE status = ${status}`
  )) as unknown as [{ total: number }];

  const data = rows.map((r) => ({
    ...r,
    category: r.category?.id ? r.category : null,
    uploader: r.uploader?.id ? r.uploader : null,
    purgeAt:
      status === "rejected" && r.rejectedAt
        ? new Date(r.rejectedAt.getTime() + REJECTED_RETENTION_DAYS * 86_400_000).toISOString()
        : null,
  }));

  return { data, total, hasMore: offset + data.length < total };
}

async function findForReview(id: string) {
  const [row] = await db
    .select({
      id: wallpapers.id,
      status: wallpapers.status,
      title: wallpapers.title,
      description: wallpapers.description,
      tags: wallpapers.tags,
      hasTextEmbedding: sql<boolean>`${wallpapers.textEmbedding} IS NOT NULL`,
    })
    .from(wallpapers)
    .where(eq(wallpapers.id, id))
    .limit(1);
  if (!row) throw new ApiError(404, "Wallpaper not found");
  if (row.status === "hidden") {
    throw new ApiError(409, "This wallpaper is hidden because its uploader's account is disabled. Re-enable the account to show it again.");
  }
  return row;
}

/** Search needs the text embedding; create it on approve if the upload didn't get one. */
function ensureTextEmbedding(row: { id: string; title: string; description: string | null; tags: string[]; hasTextEmbedding: boolean }) {
  if (row.hasTextEmbedding) return;
  void generateWallpaperTextEmbedding({ title: row.title, description: row.description, tags: row.tags })
    .then(async (textEmbedding) => {
      if (textEmbedding) await db.update(wallpapers).set({ textEmbedding }).where(eq(wallpapers.id, row.id));
    })
    .catch((e) => console.error("[embedding] Embedding on approve failed:", e));
}

/** Approve a pending upload, or restore a rejected one. */
export async function approve(adminId: string, id: string) {
  const row = await findForReview(id);
  if (row.status === "approved") throw new ApiError(409, "Already approved.");

  await db.transaction(async (tx) => {
    await tx
      .update(wallpapers)
      .set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date(), rejectedAt: null, reviewNote: null, updatedAt: new Date() })
      .where(eq(wallpapers.id, id));
    await logAdminAction(
      { adminId, action: row.status === "rejected" ? "wallpaper.restore" : "wallpaper.approve", targetType: "wallpaper", targetId: id, details: { title: row.title, from: row.status } },
      tx
    );
  });
  ensureTextEmbedding(row);
  return { id, status: "approved" as const };
}

/** Reject a pending upload (hidden at once; purged after the retention period). */
export async function reject(adminId: string, id: string, reason: string) {
  const row = await findForReview(id);
  if (row.status === "rejected") throw new ApiError(409, "Already rejected.");

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(wallpapers)
      .set({ status: "rejected", reviewedBy: adminId, reviewedAt: now, rejectedAt: now, reviewNote: reason, trendingScore: 0, updatedAt: now })
      .where(eq(wallpapers.id, id));
    await logAdminAction(
      { adminId, action: "wallpaper.reject", targetType: "wallpaper", targetId: id, details: { title: row.title, from: row.status, reason } },
      tx
    );
  });
  return { id, status: "rejected" as const };
}

/** Same as approve/reject for many ids; one bad id never fails the batch. */
export async function bulkReview(adminId: string, ids: string[], action: "approve" | "reject", reason?: string) {
  const unique = [...new Set(ids)];
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of unique) {
    try {
      if (action === "approve") await approve(adminId, id);
      else await reject(adminId, id, reason!);
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof ApiError ? e.message : "Failed" });
    }
  }
  return { action, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
}

/** Delete wallpapers rejected more than REJECTED_RETENTION_DAYS ago (row + R2 file). */
export async function purgeExpiredRejected(limit = 200) {
  const cutoff = new Date(Date.now() - REJECTED_RETENTION_DAYS * 86_400_000);
  const rows = await db
    .select({ id: wallpapers.id, fileUrl: wallpapers.fileUrl, uploaderId: wallpapers.uploaderId, title: wallpapers.title })
    .from(wallpapers)
    .where(and(eq(wallpapers.status, "rejected"), lt(wallpapers.rejectedAt, cutoff)))
    .limit(limit);

  let purged = 0;
  for (const row of rows) {
    try {
      await removeWallpaper(row);
      await logAdminAction({ adminId: null, action: "wallpaper.purge", targetType: "wallpaper", targetId: row.id, details: { title: row.title, reason: `rejected > ${REJECTED_RETENTION_DAYS} days` } });
      purged++;
    } catch (e) {
      console.error("[purge] Failed to purge rejected wallpaper", row.id, e);
    }
  }
  return { purged };
}
