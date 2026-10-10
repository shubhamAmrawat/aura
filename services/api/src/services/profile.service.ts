import bcrypt from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../config/db";
import { env } from "../config/env";
import { collections, collectionWallpapers, downloads, likes, otps, users, wallpapers } from "../models";
import { ApiError } from "../utils/ApiError";
import { buildObjectKey, deleteFile, generateUploadUrl, uploadFileToKey } from "../integrations/r2";
import { generateWallpaperTextEmbedding } from "../integrations/openai";
import { checkOtp, findUserById, issueOtp } from "./auth.service";

export type ImageKind = "avatar" | "cover";

const IMAGE = {
  avatar: { folder: "avatars", column: "avatarUrl", label: "Avatar" },
  cover: { folder: "covers", column: "coverUrl", label: "Cover" },
} as const;

export async function getUserOrThrow(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

// ─── Profile ───────────────────────────────────────────────

export async function updateProfile(
  userId: string,
  input: { displayName?: any; bio?: any; contactNo?: any; username?: any }
) {
  const user = await getUserOrThrow(userId);
  const updates: Record<string, any> = { updatedAt: new Date() };

  if (input.displayName !== undefined) updates.displayName = input.displayName;
  if (input.bio !== undefined) updates.bio = input.bio;
  if (input.contactNo !== undefined) updates.contactNo = input.contactNo;

  if (input.username !== undefined && input.username !== user.username) {
    // username can change once every 2 weeks
    if (user.usernameChangedAt) {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      if (user.usernameChangedAt > twoWeeksAgo) {
        const nextChange = new Date(user.usernameChangedAt);
        nextChange.setDate(nextChange.getDate() + 14);
        throw new ApiError(
          429,
          `Username can only be changed once every 2 weeks. Next change available on ${nextChange.toDateString()}.`
        );
      }
    }

    const existing = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
    if (existing.length > 0) throw new ApiError(409, "Username already taken.");

    updates.username = input.username;
    updates.usernameChangedAt = new Date();
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning();
  if (!updated) throw new ApiError(500, "Failed to update profile");
  return updated;
}

// ─── Avatar / cover images ────────────────────────────────

export function createImageUploadUrl(userId: string, kind: ImageKind, fileType: string) {
  return generateUploadUrl(IMAGE[kind].folder, fileType, userId);
}

/** Delete the user's previous image from R2 if it lives under their own prefix. Never throws. */
async function deleteOldImage(userId: string, kind: ImageKind, oldUrl: string | null) {
  if (!oldUrl) return;
  try {
    const prefix = `${env.R2_PUBLIC_URL}/`;
    if (oldUrl.startsWith(prefix)) {
      const oldKey = oldUrl.slice(prefix.length);
      if (oldKey.startsWith(`${IMAGE[kind].folder}/${userId}/`)) await deleteFile(oldKey);
    }
  } catch (error) {
    console.error(`Failed to cleanup previous ${kind}`, error);
  }
}

export function assertStorageConfigured(kind: ImageKind) {
  if (!env.R2_PUBLIC_URL) throw new ApiError(500, `${IMAGE[kind].label} storage is not configured.`);
}

type UserRow = NonNullable<Awaited<ReturnType<typeof findUserById>>>;

/** Confirm a presigned upload: key must be in the user's folder and match the public URL. */
export async function confirmImageUpload(user: UserRow, kind: ImageKind, fileUrl: string, key: string) {
  assertStorageConfigured(kind);
  if (!key.startsWith(`${IMAGE[kind].folder}/${user.id}/`)) throw new ApiError(400, `Invalid ${kind} key.`);
  if (fileUrl !== `${env.R2_PUBLIC_URL}/${key}`) throw new ApiError(400, `Invalid ${kind} URL.`);

  await deleteOldImage(user.id, kind, user[IMAGE[kind].column]);
  await db
    .update(users)
    .set({ [IMAGE[kind].column]: fileUrl, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  return fileUrl;
}

/** Server-side upload fallback (multipart). Validation of the file happens in the controller. */
export async function uploadImageDirect(user: UserRow, kind: ImageKind, file: { buffer: Buffer; mimetype: string }) {
  const userId = user.id;
  const oldUrl = user[IMAGE[kind].column];
  const key = buildObjectKey(IMAGE[kind].folder, file.mimetype, userId);
  const fileUrl = await uploadFileToKey(key, file.buffer, file.mimetype);

  const setUrl = () =>
    db.update(users).set({ [IMAGE[kind].column]: fileUrl, updatedAt: new Date() }).where(eq(users.id, userId));
  // Same order as before: cover saves then cleans up; avatar cleans up then saves.
  if (kind === "cover") {
    await setUrl();
    await deleteOldImage(userId, kind, oldUrl);
  } else {
    await deleteOldImage(userId, kind, oldUrl);
    await setUrl();
  }
  return fileUrl;
}

// ─── Password ──────────────────────────────────────────────

export async function startPasswordChange(userId: string, currentPassword: unknown) {
  const user = await getUserOrThrow(userId);
  if (!user.passwordHash) throw new ApiError(400, "No password set for this account.");

  const valid = await bcrypt.compare(currentPassword as string, user.passwordHash);
  if (!valid) throw new ApiError(400, "Current password is incorrect.");

  await issueOtp(user.email, "password_reset");
}

export async function confirmPasswordChange(userId: string, otp: unknown, newPassword: string) {
  const user = await getUserOrThrow(userId);
  await checkOtp(user.email, "password_reset", otp, () => "Incorrect OTP.");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
  await db.delete(otps).where(and(eq(otps.email, user.email), eq(otps.type, "password_reset")));
}

// ─── Account ───────────────────────────────────────────────

/**
 * Delete the account after a password check.
 * KNOWN BUG (kept for parity, see plan Phase 9): rows in likes/collections/wallpapers
 * referencing the user make this fail with a foreign-key error.
 */
export async function deleteAccount(userId: string, password: unknown) {
  const user = await getUserOrThrow(userId);
  if (!user.passwordHash) throw new ApiError(400, "No password set for this account.");

  const valid = await bcrypt.compare(password as string, user.passwordHash);
  if (!valid) throw new ApiError(400, "Incorrect password.");

  await deleteOldImage(userId, "avatar", user.avatarUrl);
  await db.delete(users).where(eq(users.id, user.id));
}

// ─── My uploads ────────────────────────────────────────────

export async function listUploads(userId: string, limit: number, offset: number) {
  const rows = await db
    .select({
      id: wallpapers.id,
      title: wallpapers.title,
      description: wallpapers.description,
      fileUrl: wallpapers.fileUrl,
      blurhash: wallpapers.blurhash,
      dominantColor: wallpapers.dominantColor,
      width: wallpapers.width,
      height: wallpapers.height,
      tags: wallpapers.tags,
      categoryId: wallpapers.categoryId,
      status: wallpapers.status,
      likeCount: wallpapers.likeCount,
      downloadCount: wallpapers.downloadCount,
      createdAt: wallpapers.createdAt,
      format: wallpapers.format,
      isMobile: wallpapers.isMobile,
    })
    .from(wallpapers)
    .where(eq(wallpapers.uploaderId, userId))
    .orderBy(desc(wallpapers.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  return { data: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

async function findOwnUpload(userId: string, wallpaperId: string) {
  const [existing] = await db
    .select({ id: wallpapers.id, uploaderId: wallpapers.uploaderId, fileUrl: wallpapers.fileUrl })
    .from(wallpapers)
    .where(eq(wallpapers.id, wallpaperId))
    .limit(1);
  if (!existing) throw new ApiError(404, "Wallpaper not found");
  if (existing.uploaderId !== userId) throw new ApiError(403, "Not authorized");
  return existing;
}

/** Edit metadata, then re-embed the text in the background (no vision re-run). */
export async function updateUpload(
  userId: string,
  wallpaperId: string,
  input: { title: string; description?: any; tags?: any; categoryId?: any }
) {
  await findOwnUpload(userId, wallpaperId);

  const [row] = await db
    .update(wallpapers)
    .set({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      tags: Array.isArray(input.tags) ? input.tags.map((t: string) => t.trim()).filter(Boolean) : [],
      categoryId: input.categoryId || null,
      updatedAt: new Date(),
    })
    .where(eq(wallpapers.id, wallpaperId))
    .returning();

  if (row) {
    setImmediate(() => {
      generateWallpaperTextEmbedding({ title: row.title, description: row.description, tags: row.tags })
        .then((textEmbedding) => {
          if (!textEmbedding) return;
          return db.update(wallpapers).set({ textEmbedding }).where(eq(wallpapers.id, row.id));
        })
        .catch((e) => console.error("[embedding] Re-embed on edit failed:", e));
    });
  }
  return row;
}

/** Delete an upload: dependents first, then the row, then the R2 file; decrement counter. */
export async function deleteUpload(userId: string, wallpaperId: string) {
  const existing = await findOwnUpload(userId, wallpaperId);

  await Promise.all([
    db.delete(likes).where(eq(likes.wallpaperId, wallpaperId)),
    db.delete(downloads).where(eq(downloads.wallpaperId, wallpaperId)),
    db.delete(collectionWallpapers).where(eq(collectionWallpapers.wallpaperId, wallpaperId)),
    db.update(collections).set({ coverWallpaperId: null }).where(eq(collections.coverWallpaperId, wallpaperId)),
  ]);

  await db.delete(wallpapers).where(eq(wallpapers.id, wallpaperId));

  const r2PublicUrl = (env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (r2PublicUrl && existing.fileUrl.startsWith(r2PublicUrl)) {
    const key = existing.fileUrl.slice(r2PublicUrl.length + 1);
    await deleteFile(key).catch((e) => console.error("[r2] Delete file failed (non-fatal):", e));
  }

  await db
    .update(users)
    .set({ totalUploads: sql`GREATEST(${users.totalUploads} - 1, 0)` })
    .where(eq(users.id, userId));
}
