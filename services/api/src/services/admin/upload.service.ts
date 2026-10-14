import { and, eq, lt, ne } from "drizzle-orm";
import { db } from "../../config/db";
import { env } from "../../config/env";
import { categories, categorySuggestions, uploadDrafts, wallpapers } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { deleteFile, generateUploadUrl } from "../../integrations/r2";
import { checkImageSafety } from "../../integrations/sightengine";
import { deleteThumbFor, prepareUploadedImage, type ThumbVariant } from "../wallpaperThumb.service";
import { CATEGORY_AI_MODEL } from "../categoryAi.service";
import { analyzeUpload, embedWallpaper, type UploadAnalysis } from "../uploadAi.service";
import { normalizeExtraCategories, setExtraCategories } from "../wallpaperCategories.service";
import type { ImageMetadata } from "../../utils/imageMetadata";
import type { ModerationResult } from "../../integrations/sightengine";
import type { AdminUploadInput, UploadAnalyzeInput } from "../../validators/admin.schema";

const MIN_IMAGE_DIMENSION = 200;
/** Presigned PUTs for a batch stay valid long enough for 50 large files at 3 at a time. */
const BATCH_URL_TTL_SECONDS = 60 * 60;

export const adminUploadPrefix = (adminId: string) => `wallpapers/admin/${adminId}/`;

/** One presigned PUT per file, each locked to its declared size. */
export async function createUploadUrls(adminId: string, files: { fileType: string; fileSizeBytes: number }[]) {
  const items = await Promise.all(
    files.map((f) =>
      generateUploadUrl("wallpapers/admin", f.fileType, adminId, { expiresIn: BATCH_URL_TTL_SECONDS, contentLength: f.fileSizeBytes })
    )
  );
  return { items, expiresIn: BATCH_URL_TTL_SECONDS };
}

/** What the bulk upload page shows for a file before it is published. */
export type UploadDraftView = {
  key: string;
  width: number;
  height: number;
  isMobile: boolean;
  thumbUrl: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  category: { id: string; name: string } | null;
  alternative: { id: string; name: string } | null;
  /** extra categories the AI suggests besides the main one (0–2) */
  extraCategories: { id: string; name: string }[];
  confidence: number;
  moderation: ModerationResult;
  warnings: string[];
};

export type AdminUploadResult = {
  wallpaper: {
    id: string;
    title: string;
    fileUrl: string;
    status: string;
    width: number;
    height: number;
    isMobile: boolean;
    dominantColor: string;
    format: string;
    createdAt: Date;
  };
  moderation: { status: "approved" | "pending" | "rejected"; reason: string | null };
  /** where it was filed; `auto` = picked by the AI */
  category: { id: string; name: string; auto: boolean };
  warnings: string[];
};

type Draft = typeof uploadDrafts.$inferSelect & {
  metadata: ImageMetadata;
  thumb: ThumbVariant | null;
  moderation: ModerationResult;
  analysis: UploadAnalysis;
};

function checkKey(adminId: string, input: { key: string; fileUrl: string; fileType: string }) {
  const ext = input.fileType.split("/")[1];
  if (!input.key.startsWith(adminUploadPrefix(adminId)) || !input.key.endsWith(`.${ext}`) || input.key.includes("..")) {
    throw new ApiError(400, "Invalid file key");
  }
  if (!env.R2_PUBLIC_URL || input.fileUrl !== `${env.R2_PUBLIC_URL}/${input.key}`) throw new ApiError(400, "fileUrl does not match the key");
}

async function discardFile(key: string, fileUrl: string) {
  await deleteFile(key).catch(() => {});
  await deleteThumbFor(fileUrl);
}

const categoryRows = () => db.select({ id: categories.id, slug: categories.slug, name: categories.name }).from(categories);

/**
 * Step 1 of bulk upload (file already PUT to R2): read the file once (size, colours, thumbnail),
 * run the safety check and the AI (title, description, tags, category) on the thumbnail, and
 * keep the result as a draft for the admin to review. Nothing is published. Calling it again
 * for the same key returns the existing draft.
 */
export async function analyzeAdminUpload(adminId: string, input: UploadAnalyzeInput): Promise<UploadDraftView> {
  checkKey(adminId, input);
  const existing = await getDraft(adminId, input.key);
  const cats = await categoryRows();
  if (existing) return draftView(existing, cats);

  const { metadata, thumb } = await prepareUploadedImage(input.key, input.fileUrl);
  if (!metadata.width) {
    // Nothing readable in storage (upload never finished, or not an image)
    await discardFile(input.key, input.fileUrl);
    throw new ApiError(400, "Couldn't read the image. Upload it again.");
  }
  if (metadata.width < MIN_IMAGE_DIMENSION || metadata.height < MIN_IMAGE_DIMENSION) {
    await discardFile(input.key, input.fileUrl);
    throw new ApiError(400, `Image must be at least ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} pixels.`);
  }

  // Safety check + one AI pass, both on the 600px thumbnail (faster and more reliable than a 10+ MB original)
  const aiUrl = thumb?.url ?? input.fileUrl;
  const [moderation, analysis] = await Promise.all([
    checkImageSafety(aiUrl),
    analyzeUpload(aiUrl, { title: input.title ?? "", tags: input.tags }, cats.filter((c) => c.slug !== "uncategorized")),
  ]);

  const [row] = await db
    .insert(uploadDrafts)
    .values({
      key: input.key,
      adminId,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      fileSizeBytes: input.fileSizeBytes,
      metadata,
      thumb,
      moderation,
      analysis,
    })
    .onConflictDoNothing()
    .returning();
  const draft = (row ?? (await getDraft(adminId, input.key))) as Draft | undefined;
  if (!draft) throw new ApiError(500, "Couldn't save the upload draft");
  return draftView(draft, cats);
}

async function getDraft(adminId: string, key: string) {
  const [row] = await db.select().from(uploadDrafts).where(and(eq(uploadDrafts.key, key), eq(uploadDrafts.adminId, adminId))).limit(1);
  return row as Draft | undefined;
}

async function draftView(d: Draft, cats: { id: string; name: string }[]): Promise<UploadDraftView> {
  const named = (id: string | null) => {
    const c = id ? cats.find((x) => x.id === id) : undefined;
    return c ? { id: c.id, name: c.name } : null;
  };
  const warnings: string[] = [];
  if (d.moderation.status !== "approved") {
    warnings.push(d.moderation.status === "rejected" ? "Safety check flagged this as inappropriate." : `Safety check: ${d.moderation.reason ?? "needs a manual look"}.`);
  }
  if (!d.analysis.title) warnings.push("The AI couldn't analyse this image — fill in the details yourself.");
  else if (d.analysis.categoryId && d.analysis.confidence < 0.7) warnings.push("The AI isn't sure about the category — check it.");
  const dupe = await findDuplicate(d.metadata.width, d.metadata.height, d.fileSizeBytes, d.fileUrl);
  if (dupe) warnings.push(`Possible duplicate of “${dupe.title}” (same size and dimensions).`);
  return {
    key: d.key,
    width: d.metadata.width,
    height: d.metadata.height,
    isMobile: d.metadata.isMobile,
    thumbUrl: d.thumb?.url ?? null,
    title: d.analysis.title,
    description: d.analysis.description,
    tags: d.analysis.tags,
    category: named(d.analysis.categoryId),
    alternative: named(d.analysis.alternativeId),
    extraCategories: (d.analysis.extraCategoryIds ?? []).map(named).filter((c): c is { id: string; name: string } => !!c),
    confidence: d.analysis.confidence,
    moderation: d.moderation,
    warnings,
  };
}

/** Same pixel size + same byte size as an existing wallpaper → almost certainly the same file. */
async function findDuplicate(width: number, height: number, bytes: number, fileUrl: string) {
  const [dupe] = await db
    .select({ id: wallpapers.id, title: wallpapers.title })
    .from(wallpapers)
    .where(and(eq(wallpapers.width, width), eq(wallpapers.height, height), eq(wallpapers.fileSizeBytes, bytes), ne(wallpapers.fileUrl, fileUrl)))
    .limit(1);
  return dupe;
}

/** Remove a draft the admin dropped from the batch, with its file and thumbnail. */
export async function discardAdminUpload(adminId: string, key: string) {
  const draft = await getDraft(adminId, key);
  if (!key.startsWith(adminUploadPrefix(adminId)) || key.includes("..")) throw new ApiError(400, "Invalid file key");
  const fileUrl = draft?.fileUrl ?? (env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : null);
  if (fileUrl) await discardFile(key, fileUrl);
  await db.delete(uploadDrafts).where(and(eq(uploadDrafts.key, key), eq(uploadDrafts.adminId, adminId)));
  return { key, discarded: true };
}

/** Hourly: drafts nobody published within 24 hours — delete them and their files. */
export async function purgeStaleDrafts(maxAgeHours = 24) {
  const stale = await db
    .select({ key: uploadDrafts.key, fileUrl: uploadDrafts.fileUrl })
    .from(uploadDrafts)
    .where(lt(uploadDrafts.createdAt, new Date(Date.now() - maxAgeHours * 3600_000)))
    .limit(200);
  for (const d of stale) {
    await discardFile(d.key, d.fileUrl);
    await db.delete(uploadDrafts).where(eq(uploadDrafts.key, d.key));
  }
  return { purged: stale.length };
}

/**
 * Step 2 of bulk upload: publish (or queue for review) a file with the details the admin
 * approved. Uses the draft from step 1; without one (older clients) it runs step 1 first.
 * Admin uploads have no uploader; the admin is recorded as reviewer and in the audit log.
 * The safety check never blocks admin uploads — it is returned as a warning.
 */
export async function createAdminUpload(adminId: string, input: AdminUploadInput): Promise<AdminUploadResult> {
  checkKey(adminId, input);
  const auto = input.categoryId === "auto";
  const cats = await categoryRows();
  const chosen = auto ? null : cats.find((c) => c.id === input.categoryId);
  if (!auto && !chosen) throw new ApiError(400, "Category not found");

  if (!(await getDraft(adminId, input.key))) await analyzeAdminUpload(adminId, { ...input, title: input.title });
  const draft = (await getDraft(adminId, input.key))!;
  const { metadata, thumb, moderation, analysis: ai } = draft;

  const title = input.aiTitle && ai.title ? ai.title : input.title;
  const description = input.description ?? (input.aiText ? ai.description : null);
  const tags = input.aiText ? [...input.tags, ...ai.tags.filter((t) => !input.tags.some((x) => x.toLowerCase() === t))].slice(0, 12) : input.tags;

  // "auto": the AI's pick, else Uncategorized (it then shows up in the review list), else a clear error
  const fallback = cats.find((c) => c.slug === "uncategorized");
  const category = chosen ?? cats.find((c) => c.id === ai.categoryId) ?? fallback;
  if (!category) throw new ApiError(400, "The AI couldn't pick a category. Choose one and publish again.");

  const embedding = await embedWallpaper(ai.visualDescription, { title, description, tags });
  // Extras: what the admin sent, else the AI's suggestions (never the primary, max 2)
  const extras = await normalizeExtraCategories(input.extraCategoryIds ?? ai.extraCategoryIds ?? [], category.id);

  const warnings: string[] = [];
  if (moderation.status !== "approved") {
    warnings.push(
      moderation.status === "rejected"
        ? `Safety check flagged this as inappropriate${input.publish ? " — it was published anyway" : ""}.`
        : `Safety check: ${moderation.reason ?? "needs a manual look"}.`
    );
  }
  if (!embedding) warnings.push("Search vector missing — “Similar” results stay empty until re-embedded.");
  if (input.aiTitle && !ai.title) warnings.push("The AI couldn't write a title — kept the file name.");
  const autoFellBack = auto && !ai.categoryId;
  if (autoFellBack) warnings.push("The AI couldn't pick a category — filed under Uncategorized (see Categories → AI suggestions).");
  const dupe = await findDuplicate(metadata.width, metadata.height, input.fileSizeBytes, input.fileUrl);
  if (dupe) warnings.push(`Possible duplicate of “${dupe.title}” (same size and dimensions).`);

  const format = input.fileType === "image/png" ? "png" : input.fileType === "image/webp" ? "webp" : "jpeg";
  const now = new Date();

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(wallpapers)
      .values({
        title,
        description,
        fileUrl: input.fileUrl,
        blurhash: metadata.blurhash,
        dominantColor: metadata.dominantColor,
        palette: metadata.palette,
        width: metadata.width,
        height: metadata.height,
        fileSizeBytes: input.fileSizeBytes,
        format,
        categoryId: category.id,
        uploaderId: null,
        tags,
        isPremium: input.isPremium,
        isFeatured: false,
        isAiGenerated: input.isAiGenerated,
        isMobile: metadata.isMobile,
        downloadCount: 0,
        likeCount: 0,
        viewCount: 0,
        status: input.publish ? "approved" : "pending",
        moderationReason: moderation.status === "approved" ? null : moderation.reason,
        ...(input.publish ? { reviewedBy: adminId, reviewedAt: now } : {}),
        ...(embedding ? { textEmbedding: embedding } : {}),
        ...(thumb ? { cdnVariants: { thumb } } : {}),
      })
      .returning({
        id: wallpapers.id,
        title: wallpapers.title,
        fileUrl: wallpapers.fileUrl,
        status: wallpapers.status,
        width: wallpapers.width,
        height: wallpapers.height,
        isMobile: wallpapers.isMobile,
        dominantColor: wallpapers.dominantColor,
        format: wallpapers.format,
        createdAt: wallpapers.createdAt,
      });
    if (extras.length) await setExtraCategories(row!.id, extras, tx);
    await tx.delete(uploadDrafts).where(eq(uploadDrafts.key, input.key));
    await logAdminAction(
      {
        adminId,
        action: "wallpaper.upload",
        targetType: "wallpaper",
        targetId: row!.id,
        details: { title, published: input.publish, moderation: moderation.status, category: category.name, extraCategories: extras.length, autoCategory: auto, warnings: warnings.length },
      },
      tx
    );
    return row!;
  });

  if (autoFellBack) {
    // keep it visible in the review list
    await db
      .insert(categorySuggestions)
      .values({ wallpaperId: created.id, currentCategoryId: null, suggestedCategoryId: null, confidence: 0, currentFits: null, newCategoryIdea: ai.newCategoryIdea, reason: ai.reason || "AI could not pick a category at upload", model: CATEGORY_AI_MODEL })
      .onConflictDoNothing();
  }

  return { wallpaper: created, moderation, category: { id: category.id, name: category.name, auto }, warnings };
}
