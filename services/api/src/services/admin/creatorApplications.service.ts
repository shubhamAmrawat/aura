import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db";
import { creatorApplications, creatorApplicationSamples, users } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { sendCreatorDecisionEmail } from "../../integrations/email";
import { CREATOR_RULES, runScreen } from "../creatorApplication.service";

export type ApplicationStatus = "pending" | "approved" | "rejected";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Counts per status, for the tabs and the sidebar badge. */
export async function counts() {
  const rows = await db
    .select({ status: creatorApplications.status, n: sql<number>`count(*)::int` })
    .from(creatorApplications)
    .groupBy(creatorApplications.status);
  const out = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) out[r.status as ApplicationStatus] = r.n;
  return out;
}

/** GET list: waiting ones oldest first; decided ones newest first. */
export async function list(status: ApplicationStatus, limit: number, offset: number) {
  const rows = await db
    .select({
      id: creatorApplications.id,
      status: creatorApplications.status,
      aiStatus: creatorApplications.aiStatus,
      aiScore: creatorApplications.aiScore,
      aiVerdict: creatorApplications.aiVerdict,
      createdAt: creatorApplications.createdAt,
      reviewedAt: creatorApplications.reviewedAt,
      userId: users.id,
      displayName: users.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl,
      sampleCount: sql<number>`(select count(*)::int from creator_application_samples s where s.application_id = ${creatorApplications.id})`,
      cover: sql<string | null>`(select coalesce(s.thumb_url, s.file_url) from creator_application_samples s where s.application_id = ${creatorApplications.id} order by s.position limit 1)`,
    })
    .from(creatorApplications)
    .innerJoin(users, eq(users.id, creatorApplications.userId))
    .where(eq(creatorApplications.status, status))
    .orderBy(status === "pending" ? asc(creatorApplications.createdAt) : desc(creatorApplications.reviewedAt))
    .limit(limit)
    .offset(offset);
  return {
    data: rows.map((r) => ({ ...r, createdAt: iso(r.createdAt), reviewedAt: iso(r.reviewedAt) })),
    counts: await counts(),
  };
}

/** One application with its samples, the applicant and their earlier attempts. */
export async function detail(id: string) {
  const reviewer = alias(users, "reviewer");
  const [row] = await db
    .select({
      app: creatorApplications,
      user: {
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        isCreator: users.isCreator,
        totalUploads: users.totalUploads,
      },
      reviewerName: reviewer.displayName,
    })
    .from(creatorApplications)
    .innerJoin(users, eq(users.id, creatorApplications.userId))
    .leftJoin(reviewer, eq(reviewer.id, creatorApplications.reviewedBy))
    .where(eq(creatorApplications.id, id))
    .limit(1);
  if (!row) throw new ApiError(404, "Application not found");

  const [samples, history] = await Promise.all([
    db
      .select()
      .from(creatorApplicationSamples)
      .where(eq(creatorApplicationSamples.applicationId, id))
      .orderBy(asc(creatorApplicationSamples.position)),
    db
      .select({ id: creatorApplications.id, status: creatorApplications.status, createdAt: creatorApplications.createdAt, reviewedAt: creatorApplications.reviewedAt })
      .from(creatorApplications)
      .where(eq(creatorApplications.userId, row.user.id))
      .orderBy(desc(creatorApplications.createdAt)),
  ]);

  // Rejections in a row before this one (since their last approval) → what a rejection now would trigger.
  const earlier = history.filter((h) => h.createdAt < row.app.createdAt);
  const lastApproved = earlier.findIndex((h) => h.status === "approved");
  const rejectionsBefore = (lastApproved === -1 ? earlier : earlier.slice(0, lastApproved)).filter((h) => h.status === "rejected").length;
  const pausesOnReject = (rejectionsBefore + 1) % CREATOR_RULES.rejectionsBeforePause === 0;

  const a = row.app;
  return {
    id: a.id,
    status: a.status,
    about: a.about,
    portfolioUrl: a.portfolioUrl,
    aiStatus: a.aiStatus,
    aiScore: a.aiScore,
    aiVerdict: a.aiVerdict,
    aiSummary: a.aiSummary,
    aiApproveMessage: a.aiApproveMessage,
    aiRejectMessage: a.aiRejectMessage,
    reviewNote: a.reviewNote,
    reviewedAt: iso(a.reviewedAt),
    reviewerName: row.reviewerName,
    createdAt: iso(a.createdAt),
    user: { ...row.user, createdAt: iso(row.user.createdAt) },
    attempt: earlier.length + 1,
    rejectionsBefore,
    pausesOnReject,
    samples: samples.map((s) => ({
      id: s.id,
      fileUrl: s.fileUrl,
      thumbUrl: s.thumbUrl ?? s.fileUrl,
      width: s.width,
      height: s.height,
      bytes: s.bytes,
      aiScore: s.aiScore,
      aiNote: s.aiNote,
    })),
  };
}

async function pendingOrThrow(id: string) {
  const [row] = await db
    .select({ app: creatorApplications, email: users.email, name: users.displayName })
    .from(creatorApplications)
    .innerJoin(users, eq(users.id, creatorApplications.userId))
    .where(eq(creatorApplications.id, id))
    .limit(1);
  if (!row) throw new ApiError(404, "Application not found");
  if (row.app.status !== "pending") throw new ApiError(409, "This application was already decided.");
  return row;
}

/** Approve → the user becomes a creator; they get an email. */
export async function approve(adminId: string, id: string, note: string | null) {
  const row = await pendingOrThrow(id);
  await db.transaction(async (tx) => {
    const done = await tx
      .update(creatorApplications)
      .set({ status: "approved", reviewNote: note, reviewedBy: adminId, reviewedAt: new Date() })
      .where(and(eq(creatorApplications.id, id), eq(creatorApplications.status, "pending")))
      .returning({ id: creatorApplications.id });
    if (!done.length) throw new ApiError(409, "This application was already decided.");
    await tx.update(users).set({ isCreator: true, updatedAt: new Date() }).where(eq(users.id, row.app.userId));
    await logAdminAction(
      { adminId, action: "creator.application.approve", targetType: "user", targetId: row.app.userId, details: { email: row.email, applicationId: id, aiScore: row.app.aiScore } },
      tx
    );
  });
  void sendCreatorDecisionEmail(row.email, row.name, true, note);
  return detail(id);
}

/** Reject with a note the applicant sees. */
export async function reject(adminId: string, id: string, note: string) {
  const row = await pendingOrThrow(id);
  await db.transaction(async (tx) => {
    const done = await tx
      .update(creatorApplications)
      .set({ status: "rejected", reviewNote: note, reviewedBy: adminId, reviewedAt: new Date() })
      .where(and(eq(creatorApplications.id, id), eq(creatorApplications.status, "pending")))
      .returning({ id: creatorApplications.id });
    if (!done.length) throw new ApiError(409, "This application was already decided.");
    await logAdminAction(
      { adminId, action: "creator.application.reject", targetType: "user", targetId: row.app.userId, details: { email: row.email, applicationId: id, note, aiScore: row.app.aiScore } },
      tx
    );
  });
  void sendCreatorDecisionEmail(row.email, row.name, false, note);
  return detail(id);
}

/** Run the AI pre-screen again (e.g. after it failed). Waits for the result. */
export async function rescore(id: string) {
  const [app] = await db.select({ id: creatorApplications.id }).from(creatorApplications).where(eq(creatorApplications.id, id)).limit(1);
  if (!app) throw new ApiError(404, "Application not found");
  await db.update(creatorApplications).set({ aiStatus: "pending" }).where(eq(creatorApplications.id, id));
  await runScreen(id);
  return detail(id);
}


