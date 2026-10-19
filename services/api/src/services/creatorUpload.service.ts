import { and, eq } from "drizzle-orm";
import { db } from "../config/db";
import { env } from "../config/env";
import { categories, uploadDrafts } from "../models";
import { ApiError } from "../utils/ApiError";
import { deleteFile } from "../integrations/r2";
import { checkImageSafety, type ModerationResult } from "../integrations/sightengine";
import { deleteThumbFor, prepareUploadedImage, type ThumbVariant } from "./wallpaperThumb.service";
import { analyzeUpload, type UploadAnalysis } from "./uploadAi.service";
import { findImageDuplicate, type DuplicateMatch } from "./duplicate.service";
import type { ImageMetadata } from "../utils/imageMetadata";

/**
 * Creator upload, step 1 ("prepare"), right after the browser/app PUT the file to storage:
 * read it once (size, colours, thumbnail, fingerprint), check it isn't already on Aurora, run the
 * safety check and the AI (title, description, tags, categories) — so the upload page can show a live
 * preview with the details filled in. Kept as a draft (upload_drafts, shared with admin bulk upload;
 * the owner is in admin_id) that step 2 (POST /api/wallpapers/upload) publishes without redoing the work.
 */

/** Shortest side for creator uploads — the same bar as creator applications. */
export const MIN_SHORT_SIDE = 1080;

export type CreatorDraftMetadata = ImageMetadata & {
  print?: { phash: string; signature: string } | null;
  /** A "very similar" (review-level) match found at prepare time */
  duplicate?: DuplicateMatch | null;
};

export type CreatorDraft = typeof uploadDrafts.$inferSelect & {
  metadata: CreatorDraftMetadata;
  thumb: ThumbVariant | null;
  moderation: ModerationResult;
  analysis: UploadAnalysis;
};

export type PrepareInput = { key: string; fileUrl: string; fileType: string; fileSizeBytes: number };

/** What the upload page shows before publishing. */
export function draftView(d: CreatorDraft) {
  const a = d.analysis;
  return {
    key: d.key,
    fileUrl: d.fileUrl,
    thumbUrl: d.thumb?.url ?? null,
    width: d.metadata.width,
    height: d.metadata.height,
    isMobile: d.metadata.isMobile,
    fileSizeBytes: d.fileSizeBytes,
    dominantColor: d.metadata.dominantColor,
    palette: d.metadata.palette,
    suggestions: {
      title: a.title,
      description: a.description,
      tags: a.tags,
      categoryId: a.categoryId,
      alternativeId: a.alternativeId,
      extraCategoryIds: a.extraCategoryIds ?? [],
      confident: !!a.categoryId && a.confidence >= 0.7,
    },
    /** Very similar to a wallpaper on Aurora: it can be published, but goes to review */
    similarTo: d.metadata.duplicate ? publicMatch(d.metadata.duplicate) : null,
  };
}

/** What we tell the uploader about a match (no internal scores). */
export function publicMatch(m: DuplicateMatch) {
  return { id: m.id, title: m.title, thumbUrl: m.thumbUrl, by: m.uploaderUsername, yours: false as boolean };
}

export function checkCreatorKey(userId: string, input: { key: string; fileUrl: string; fileType: string }) {
  const ext = input.fileType.split("/")[1];
  if (!input.key.startsWith(`wallpapers/${userId}/`) || !input.key.endsWith(`.${ext}`) || input.key.includes("..")) {
    throw new ApiError(400, "Invalid file key");
  }
  if (!env.R2_PUBLIC_URL || input.fileUrl !== `${env.R2_PUBLIC_URL}/${input.key}`) throw new ApiError(400, "fileUrl does not match the key");
}

export async function discardUploadedFile(key: string, fileUrl: string) {
  await deleteFile(key).catch(() => {});
  await deleteThumbFor(fileUrl);
}

export async function getCreatorDraft(userId: string, key: string) {
  const [row] = await db
    .select()
    .from(uploadDrafts)
    .where(and(eq(uploadDrafts.key, key), eq(uploadDrafts.adminId, userId)))
    .limit(1);
  return row as CreatorDraft | undefined;
}

/** 409 for an upload that is the same picture as a wallpaper on Aurora. */
export function duplicateError(match: DuplicateMatch, userId: string) {
  const yours = match.uploaderId === userId;
  return new ApiError(
    409,
    yours
      ? `You’ve already uploaded this wallpaper (“${match.title}”).`
      : `This wallpaper is already on Aurora (“${match.title}”${match.uploaderUsername ? ` by @${match.uploaderUsername}` : ""}).`,
    { duplicate: { ...publicMatch(match), yours } }
  );
}

export async function prepareCreatorUpload(userId: string, input: PrepareInput) {
  checkCreatorKey(userId, input);
  const existing = await getCreatorDraft(userId, input.key);
  if (existing) return draftView(existing);

  const { metadata, thumb, print } = await prepareUploadedImage(input.key, input.fileUrl);
  if (!metadata.width) {
    await discardUploadedFile(input.key, input.fileUrl);
    throw new ApiError(400, "Couldn't read the image. Upload it again.");
  }
  if (Math.min(metadata.width, metadata.height) < MIN_SHORT_SIDE) {
    await discardUploadedFile(input.key, input.fileUrl);
    throw new ApiError(400, `This image is ${metadata.width} × ${metadata.height}. Use at least ${MIN_SHORT_SIDE} px on the short side so it looks sharp on phones.`);
  }

  const duplicate = print ? await findImageDuplicate(print) : null;
  if (duplicate?.level === "block") {
    await discardUploadedFile(input.key, input.fileUrl);
    throw duplicateError(duplicate, userId);
  }

  // Safety check + one AI pass, both on the 600 px thumbnail
  const aiUrl = thumb?.url ?? input.fileUrl;
  const cats = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(eq(categories.isHidden, false));
  const [moderation, analysis] = await Promise.all([
    checkImageSafety(aiUrl),
    analyzeUpload(aiUrl, { title: "", tags: [] }, cats.filter((c) => c.slug !== "uncategorized")),
  ]);
  if (moderation.status === "rejected") {
    await discardUploadedFile(input.key, input.fileUrl);
    throw new ApiError(422, moderation.reason || "This image goes against our content guidelines.");
  }

  const draftMeta: CreatorDraftMetadata = { ...metadata, print, duplicate };
  const [row] = await db
    .insert(uploadDrafts)
    .values({
      key: input.key,
      adminId: userId,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      fileSizeBytes: input.fileSizeBytes,
      metadata: draftMeta,
      thumb,
      moderation,
      analysis,
    })
    .onConflictDoNothing()
    .returning();
  const draft = (row as CreatorDraft | undefined) ?? (await getCreatorDraft(userId, input.key));
  if (!draft) throw new ApiError(500, "Couldn't save the upload");
  return draftView(draft);
}

/** The creator removed the image before publishing: delete it and its draft. */
export async function discardCreatorUpload(userId: string, key: string) {
  if (!key.startsWith(`wallpapers/${userId}/`) || key.includes("..")) throw new ApiError(400, "Invalid file key");
  const draft = await getCreatorDraft(userId, key);
  const fileUrl = draft?.fileUrl ?? (env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : null);
  if (fileUrl) await discardUploadedFile(key, fileUrl);
  await db.delete(uploadDrafts).where(and(eq(uploadDrafts.key, key), eq(uploadDrafts.adminId, userId)));
  return { discarded: true };
}
