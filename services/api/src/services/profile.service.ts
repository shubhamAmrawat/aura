import bcrypt from "bcryptjs";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../config/db";
import { env } from "../config/env";
import { collections, collectionWallpapers, downloads, likes, otps, users, wallpapers } from "../models";
import { ApiError } from "../utils/ApiError";
import { buildObjectKey, deleteFile, generateUploadUrl, keyFromPublicUrl, uploadFileToKey } from "../integrations/r2";
import { generateWallpaperTextEmbedding } from "../integrations/openai";
import { checkOtp, findUserById, issueOtp } from "./auth.service";
import { removeWallpaper } from "./wallpaperRemoval.service";

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
    const oldKey = keyFromPublicUrl(oldUrl);
    if (oldKey?.startsWith(`${IMAGE[kind].folder}/${userId}/`)) await deleteFile(oldKey);
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

const r2KeyFromUrl = keyFromPublicUrl;

/**
 * Delete the account after a password check, together with everything it owns:
 * likes (like counts are decremented), collections, uploaded wallpapers (and every
 * like / collection entry / download row pointing at them), OTPs, then the user.
 * The user's own download history is kept anonymously (user_id → NULL).
 * DB work runs in one transaction; R2 files are removed afterwards (best effort).
 */
export async function sendDeleteAccountOtp(userId: string) {
  const user = await getUserOrThrow(userId);
  if (user.passwordHash) throw new ApiError(400, "Use your password to delete your account.");
  await issueOtp(user.email, "account_delete");
}

export async function deleteAccount(userId: string, proof: { password?: unknown; otp?: unknown }) {
  const user = await getUserOrThrow(userId);

  if (user.passwordHash) {
    const valid = await bcrypt.compare(proof.password as string, user.passwordHash);
    if (!valid) throw new ApiError(400, "Incorrect password.");
  } else {
    // Google-only account: confirm with the code from POST /api/profile/delete/otp
    if (!proof.otp) throw new ApiError(400, "Verification code is required.");
    await checkOtp(user.email, "account_delete", proof.otp, () => "Incorrect OTP.");
  }

  await purgeAccount(user);
}

/**
 * Delete an account and everything it owns (shared by self-delete and the admin dashboard).
 * DB work runs in one transaction; R2 files are removed afterwards (best effort).
 * Returns how many uploads were removed.
 */
export async function purgeAccount(user: { id: string; email: string; avatarUrl: string | null; coverUrl: string | null }) {
  const userId = user.id;
  const uploads = await db
    .select({ id: wallpapers.id, fileUrl: wallpapers.fileUrl })
    .from(wallpapers)
    .where(eq(wallpapers.uploaderId, userId));
  const uploadIds = uploads.map((w) => w.id);

  await db.transaction(async (tx) => {
    // 1. The user's likes on other wallpapers: keep like_count in sync, then remove.
    await tx.execute(sql`
      UPDATE wallpapers SET like_count = GREATEST(like_count - 1, 0)
      WHERE id IN (SELECT wallpaper_id FROM likes WHERE user_id = ${userId})`);
    await tx.delete(likes).where(eq(likes.userId, userId));

    // 2. The user's collections.
    const owned = tx.select({ id: collections.id }).from(collections).where(eq(collections.userId, userId));
    await tx.delete(collectionWallpapers).where(inArray(collectionWallpapers.collectionId, owned));
    await tx.delete(collections).where(eq(collections.userId, userId));

    // 3. The user's uploads and everything that references them.
    if (uploadIds.length > 0) {
      await tx.delete(likes).where(inArray(likes.wallpaperId, uploadIds));
      await tx.delete(downloads).where(inArray(downloads.wallpaperId, uploadIds));
      await tx.delete(collectionWallpapers).where(inArray(collectionWallpapers.wallpaperId, uploadIds));
      await tx
        .update(collections)
        .set({ coverWallpaperId: null })
        .where(inArray(collections.coverWallpaperId, uploadIds));
      await tx.delete(wallpapers).where(inArray(wallpapers.id, uploadIds));
    }

    // 4. Anonymise the user's own download history and reviews, drop OTPs, delete the user.
    //    (admin_actions.admin_id is ON DELETE SET NULL, so the audit log is kept.)
    await tx.update(downloads).set({ userId: null }).where(eq(downloads.userId, userId));
    await tx.update(wallpapers).set({ reviewedBy: null }).where(eq(wallpapers.reviewedBy, userId));
    await tx.delete(otps).where(eq(otps.email, user.email));
    await tx.delete(users).where(eq(users.id, userId));
  });

  const keys = [
    ...uploads.map((w) => r2KeyFromUrl(w.fileUrl)),
    r2KeyFromUrl(user.avatarUrl),
    r2KeyFromUrl(user.coverUrl),
  ].filter((k): k is string => k !== null);
  await Promise.all(
    keys.map((key) => deleteFile(key).catch((e) => console.error("[r2] Account delete cleanup failed:", key, e)))
  );
  return { uploadsRemoved: uploads.length };
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
  await removeWallpaper({ id: wallpaperId, fileUrl: existing.fileUrl, uploaderId: userId });
}
