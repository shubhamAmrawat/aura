import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../config/db";
import { env } from "../config/env";
import { creatorApplications, creatorApplicationSamples, users } from "../models";
import { ApiError } from "../utils/ApiError";
import { deleteFile, generateUploadUrl, getFileBytes, keyFromPublicUrl, uploadFileToKey } from "../integrations/r2";
import { extractImageMetadataFromBuffer } from "../utils/imageMetadata";
import { heavyImageWork, renderThumb, thumbKeyFor } from "./wallpaperThumb.service";
import { screenApplication } from "./creatorAi.service";

/** Rules of the creator program — the web and app show the same numbers. */
export const CREATOR_RULES = {
  minSamples: 3,
  maxSamples: 6,
  /** Shortest side of each sample, in pixels */
  minShortSide: 1080,
  maxBytes: 25 * 1024 * 1024,
  /** Every Nth rejection in a row starts a pause before the next application */
  rejectionsBeforePause: 3,
  pauseHours: 24,
  aboutMaxLength: 1000,
};

/** Unsent samples one person can have at a time (stops endless uploads to our bucket). */
const MAX_DRAFT_SAMPLES = 12;
const SAMPLE_FOLDER = "applications";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Sample = typeof creatorApplicationSamples.$inferSelect;
type Application = typeof creatorApplications.$inferSelect;

const publicSample = (s: Sample) => ({ id: s.id, thumbUrl: s.thumbUrl ?? s.fileUrl, width: s.width, height: s.height });

/** Delete a sample's original and preview from the bucket (best effort). */
async function deleteSampleFiles(s: Pick<Sample, "fileUrl" | "thumbUrl">) {
  for (const url of [s.fileUrl, s.thumbUrl]) {
    const key = keyFromPublicUrl(url);
    if (key) await deleteFile(key).catch(() => undefined);
  }
}

// ─── Status ────────────────────────────────────────────────

/**
 * Where the person stands: creator, an application in review, or free to apply (maybe after a pause).
 * Rejections are counted since the last approval; after every 3rd, applying waits 24 h from that rejection.
 */
export async function getStatus(userId: string) {
  const [user] = await db.select({ isCreator: users.isCreator }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(404, "User not found");

  const apps = await db
    .select()
    .from(creatorApplications)
    .where(eq(creatorApplications.userId, userId))
    .orderBy(desc(creatorApplications.createdAt));

  const latest = apps[0] ?? null;
  const lastApproved = apps.findIndex((a) => a.status === "approved");
  const sinceApproval = lastApproved === -1 ? apps : apps.slice(0, lastApproved);
  const rejections = sinceApproval.filter((a) => a.status === "rejected");
  const n = CREATOR_RULES.rejectionsBeforePause;

  let nextApplyAt: Date | null = null;
  if (rejections.length > 0 && rejections.length % n === 0 && rejections[0]!.reviewedAt) {
    const until = new Date(rejections[0]!.reviewedAt.getTime() + CREATOR_RULES.pauseHours * 3600_000);
    if (until > new Date()) nextApplyAt = until;
  }

  const [latestSamples, drafts] = await Promise.all([
    latest
      ? db
          .select()
          .from(creatorApplicationSamples)
          .where(eq(creatorApplicationSamples.applicationId, latest.id))
          .orderBy(asc(creatorApplicationSamples.position))
      : Promise.resolve([] as Sample[]),
    // Images uploaded to the form but not sent yet — the form picks up where they left off.
    db
      .select()
      .from(creatorApplicationSamples)
      .where(and(eq(creatorApplicationSamples.userId, userId), isNull(creatorApplicationSamples.applicationId)))
      .orderBy(asc(creatorApplicationSamples.createdAt)),
  ]);

  const pending = latest?.status === "pending";
  return {
    isCreator: user.isCreator,
    canApply: !user.isCreator && !pending && !nextApplyAt,
    nextApplyAt: nextApplyAt?.toISOString() ?? null,
    /** Applications left before the next pause (counts the one they'd send now) */
    triesBeforePause: n - (rejections.length % n),
    rejections: rejections.length,
    application: latest
      ? {
          id: latest.id,
          status: latest.status,
          note: latest.status === "rejected" ? latest.reviewNote : null,
          createdAt: latest.createdAt.toISOString(),
          reviewedAt: latest.reviewedAt?.toISOString() ?? null,
          samples: latestSamples.map(publicSample),
        }
      : null,
    drafts: drafts.map(publicSample),
    rules: CREATOR_RULES,
  };
}

async function assertCanApply(userId: string) {
  const s = await getStatus(userId);
  if (s.isCreator) throw new ApiError(409, "You’re already a creator.");
  if (s.application?.status === "pending") throw new ApiError(409, "Your application is already in review.");
  if (s.nextApplyAt) throw new ApiError(429, "You can apply again after your pause ends.");
  return s;
}

// ─── Samples (uploaded while filling in the form) ──────────

/** Signed URL for uploading one sample straight to the bucket. */
export async function sampleUploadUrl(userId: string, fileType: string, size: number) {
  await assertCanApply(userId);
  if (!ALLOWED_TYPES.has(fileType)) throw new ApiError(400, "Use a JPG, PNG or WebP image.");
  if (!Number.isFinite(size) || size <= 0 || size > CREATOR_RULES.maxBytes) throw new ApiError(400, "Each image must be smaller than 25 MB.");
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(creatorApplicationSamples)
    .where(and(eq(creatorApplicationSamples.userId, userId), isNull(creatorApplicationSamples.applicationId)))) as [{ n: number }];
  if (n >= MAX_DRAFT_SAMPLES) throw new ApiError(429, "Too many unsent images. Remove some and try again.");
  return generateUploadUrl(SAMPLE_FOLDER, fileType, userId, { expiresIn: 600, contentLength: size });
}

/**
 * After the browser/app uploaded a sample: check it's a real image of at least 1080 px on the short side,
 * make its 600 px preview, and keep it as an unsent sample. Too small or unreadable → removed + 400.
 */
export async function addSample(userId: string, key: string) {
  if (!key.startsWith(`${SAMPLE_FOLDER}/${userId}/`) || key.includes("..")) throw new ApiError(400, "Invalid upload.");
  const fileUrl = `${env.R2_PUBLIC_URL}/${key}`;

  const result = await heavyImageWork(async () => {
    let bytes: Buffer;
    try {
      bytes = await getFileBytes(key);
    } catch {
      throw new ApiError(400, "Upload not found. Try again.");
    }
    const meta = await extractImageMetadataFromBuffer(bytes);
    if (!meta.width) return { error: "That file isn’t an image we can read." as const };
    if (Math.min(meta.width, meta.height) < CREATOR_RULES.minShortSide) {
      return { error: `This image is ${meta.width} × ${meta.height}. Use at least ${CREATOR_RULES.minShortSide} px on the short side.` };
    }
    const thumb = await renderThumb(bytes);
    const thumbUrl = await uploadFileToKey(thumbKeyFor(key), thumb.data, "image/webp", "public, max-age=31536000, immutable");
    return { width: meta.width, height: meta.height, bytes: bytes.length, thumbUrl };
  });

  if ("error" in result) {
    await deleteFile(key).catch(() => undefined);
    throw new ApiError(400, result.error ?? "That file isn’t an image we can read.");
  }
  const [row] = await db
    .insert(creatorApplicationSamples)
    .values({ userId, fileUrl, thumbUrl: result.thumbUrl, width: result.width, height: result.height, bytes: result.bytes })
    .returning();
  return publicSample(row!);
}

/** Remove an unsent sample (and its files). */
export async function removeSample(userId: string, sampleId: string) {
  const [row] = await db
    .delete(creatorApplicationSamples)
    .where(and(
      eq(creatorApplicationSamples.id, sampleId),
      eq(creatorApplicationSamples.userId, userId),
      isNull(creatorApplicationSamples.applicationId)
    ))
    .returning();
  if (!row) throw new ApiError(404, "Sample not found.");
  await deleteSampleFiles(row);
}

// ─── Submit ────────────────────────────────────────────────

export async function submit(userId: string, input: { sampleIds: string[]; about: string | null; portfolioUrl: string | null }) {
  await assertCanApply(userId);
  const ids = [...new Set(input.sampleIds)];
  if (ids.length < CREATOR_RULES.minSamples || ids.length > CREATOR_RULES.maxSamples) {
    throw new ApiError(400, `Add ${CREATOR_RULES.minSamples} to ${CREATOR_RULES.maxSamples} wallpapers.`);
  }

  const app = await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: creatorApplicationSamples.id })
      .from(creatorApplicationSamples)
      .where(and(
        inArray(creatorApplicationSamples.id, ids),
        eq(creatorApplicationSamples.userId, userId),
        isNull(creatorApplicationSamples.applicationId)
      ));
    if (owned.length !== ids.length) throw new ApiError(400, "Some images are missing. Re-add them and try again.");

    let created: Application | undefined;
    try {
      [created] = await tx
        .insert(creatorApplications)
        .values({ userId, about: input.about, portfolioUrl: input.portfolioUrl })
        .returning();
    } catch {
      // the one-pending-per-user index: a double submit
      throw new ApiError(409, "Your application is already in review.");
    }
    for (const [i, id] of ids.entries()) {
      await tx.update(creatorApplicationSamples).set({ applicationId: created!.id, position: i }).where(eq(creatorApplicationSamples.id, id));
    }
    return created!;
  });

  // Unused unsent samples aren't needed any more.
  void clearDrafts(userId);
  // AI pre-screen in the background; the admin queue shows "Scoring…" until it's done.
  void runScreen(app.id);
  return getStatus(userId);
}

async function clearDrafts(userId: string) {
  try {
    const rows = await db
      .delete(creatorApplicationSamples)
      .where(and(eq(creatorApplicationSamples.userId, userId), isNull(creatorApplicationSamples.applicationId)))
      .returning();
    await Promise.all(rows.map(deleteSampleFiles));
  } catch (err) {
    console.error("[creator] clearing unsent samples failed:", err);
  }
}

/** Score an application with the AI (also used by the admin "Score again" button). Never throws. */
export async function runScreen(applicationId: string) {
  try {
    const samples = await db
      .select()
      .from(creatorApplicationSamples)
      .where(eq(creatorApplicationSamples.applicationId, applicationId))
      .orderBy(asc(creatorApplicationSamples.position));
    const result = await screenApplication(
      samples.map((s) => ({ thumbUrl: s.thumbUrl ?? s.fileUrl, width: s.width, height: s.height, bytes: s.bytes }))
    );
    await db.transaction(async (tx) => {
      for (const [i, s] of samples.entries()) {
        await tx
          .update(creatorApplicationSamples)
          .set({ aiScore: result.samples[i]!.score, aiNote: result.samples[i]!.note || null })
          .where(eq(creatorApplicationSamples.id, s.id));
      }
      await tx
        .update(creatorApplications)
        .set({
          aiStatus: "done",
          aiScore: result.score,
          aiVerdict: result.verdict,
          aiSummary: result.summary || null,
          aiApproveMessage: result.approveMessage || null,
          aiRejectMessage: result.rejectMessage || null,
        })
        .where(eq(creatorApplications.id, applicationId));
    });
  } catch (err) {
    console.error("[creator] AI pre-screen failed:", applicationId, err);
    await db.update(creatorApplications).set({ aiStatus: "failed" }).where(eq(creatorApplications.id, applicationId)).catch(() => undefined);
  }
}

export { deleteSampleFiles };
