import { and, eq, ne } from "drizzle-orm";
import { db } from "../../config/db";
import { env } from "../../config/env";
import { categories, categorySuggestions, wallpapers } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { deleteFile, generateUploadUrl } from "../../integrations/r2";
import { checkImageSafety } from "../../integrations/sightengine";
import { generateVisionEmbedding } from "../../integrations/openai";
import { extractImageMetadata } from "../../utils/imageMetadata";
import { deleteThumbFor, tryCreateThumb } from "../wallpaperThumb.service";
import { CATEGORY_AI_MODEL, classifyWallpaperCategory } from "../categoryAi.service";
import type { AdminUploadInput } from "../../validators/admin.schema";

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

/**
 * Admin upload (file already PUT to R2): same pipeline as creator uploads — metadata,
 * colours, blurhash, vision+text embedding, Sightengine — but the safety check never
 * blocks (it's returned as a warning), there's no hourly quota, and the row is
 * published straight away unless `publish` is false (then it waits in the review queue).
 * Seeded/official wallpapers have no uploader, so admin uploads don't either; the admin
 * is recorded as the reviewer and in the audit log.
 */
export async function createAdminUpload(adminId: string, input: AdminUploadInput): Promise<AdminUploadResult> {
  const { key, fileUrl } = input;
  const ext = input.fileType.split("/")[1];
  if (!key.startsWith(adminUploadPrefix(adminId)) || !key.endsWith(`.${ext}`) || key.includes("..")) {
    throw new ApiError(400, "Invalid file key");
  }
  if (!env.R2_PUBLIC_URL || fileUrl !== `${env.R2_PUBLIC_URL}/${key}`) throw new ApiError(400, "fileUrl does not match the key");

  const auto = input.categoryId === "auto";
  const allCats = await db.select({ id: categories.id, slug: categories.slug, name: categories.name }).from(categories);
  const chosen = auto ? null : allCats.find((c) => c.id === input.categoryId);
  if (!auto && !chosen) throw new ApiError(400, "Category not found");

  const [moderation, metadata, embedding, aiPick, thumb] = await Promise.all([
    checkImageSafety(fileUrl),
    extractImageMetadata(fileUrl),
    generateVisionEmbedding(fileUrl, { title: input.title, description: input.description, tags: input.tags }).catch((err) => {
      console.error("[embedding] Vision embedding failed during admin upload:", err);
      return null;
    }),
    auto
      ? classifyWallpaperCategory(
          { imageUrl: fileUrl, title: input.title, description: input.description, tags: input.tags },
          allCats.filter((c) => c.slug !== "uncategorized")
        ).catch((err) => {
          console.error("[category-ai] failed during admin upload:", err);
          return null;
        })
      : Promise.resolve(null),
    tryCreateThumb(fileUrl),
  ]);
  const discard = async () => {
    await deleteFile(key).catch(() => {});
    await deleteThumbFor(fileUrl);
  };

  // "auto": the AI's pick, else Uncategorized (it then shows up in the review list), else a clear error
  const fallback = allCats.find((c) => c.slug === "uncategorized");
  const category = chosen ?? allCats.find((c) => c.id === aiPick?.categoryId) ?? fallback;
  if (!category) {
    await discard();
    throw new ApiError(400, "The AI couldn't pick a category. Choose one and upload again.");
  }

  const width = metadata.width || input.width || 0;
  const height = metadata.height || input.height || 0;
  if (!metadata.width) {
    // Nothing readable at the URL (upload never finished, or not an image)
    await discard();
    throw new ApiError(400, "Couldn't read the image. Upload it again.");
  }
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    await discard();
    throw new ApiError(400, `Image must be at least ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} pixels.`);
  }

  const warnings: string[] = [];
  if (moderation.status !== "approved") {
    warnings.push(
      moderation.status === "rejected"
        ? `Safety check flagged this as inappropriate${input.publish ? " — it was published anyway" : ""}.`
        : `Safety check: ${moderation.reason ?? "needs a manual look"}.`
    );
  }
  if (!embedding) warnings.push("Search vector missing — “Similar” results stay empty until re-embedded.");
  const autoFellBack = auto && !aiPick?.categoryId;
  if (autoFellBack) warnings.push("The AI couldn't pick a category — filed under Uncategorized (see Categories → AI suggestions).");

  // Same pixel size + same byte size as an existing wallpaper → almost certainly the same file
  const [dupe] = await db
    .select({ id: wallpapers.id, title: wallpapers.title })
    .from(wallpapers)
    .where(and(eq(wallpapers.width, width), eq(wallpapers.height, height), eq(wallpapers.fileSizeBytes, input.fileSizeBytes), ne(wallpapers.fileUrl, fileUrl)))
    .limit(1);
  if (dupe) warnings.push(`Possible duplicate of “${dupe.title}” (same size and dimensions).`);

  const format = input.fileType === "image/png" ? "png" : input.fileType === "image/webp" ? "webp" : "jpeg";
  const now = new Date();

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(wallpapers)
      .values({
        title: input.title,
        description: input.description,
        fileUrl,
        blurhash: metadata.blurhash,
        dominantColor: metadata.dominantColor,
        palette: metadata.palette,
        width,
        height,
        fileSizeBytes: input.fileSizeBytes,
        format,
        categoryId: category.id,
        uploaderId: null,
        tags: input.tags,
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
    await logAdminAction(
      {
        adminId,
        action: "wallpaper.upload",
        targetType: "wallpaper",
        targetId: row!.id,
        details: { title: input.title, published: input.publish, moderation: moderation.status, category: category.name, autoCategory: auto, warnings: warnings.length },
      },
      tx
    );
    return row!;
  });

  if (autoFellBack) {
    // keep it visible in the review list
    await db
      .insert(categorySuggestions)
      .values({ wallpaperId: created.id, currentCategoryId: null, suggestedCategoryId: null, confidence: 0, currentFits: null, newCategoryIdea: aiPick?.newCategoryIdea ?? null, reason: aiPick?.reason ?? "AI could not pick a category at upload", model: CATEGORY_AI_MODEL })
      .onConflictDoNothing();
  }

  return { wallpaper: created, moderation, category: { id: category.id, name: category.name, auto }, warnings };
}

