import { and, asc, desc, eq, gt, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/db";
import { adminActions, categories, collections, downloads, likes, users, wallpapers } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";
import { purgeAccount } from "../profile.service";
import { forgetAccountStatus } from "../../utils/accountStatus";
import { alias } from "drizzle-orm/pg-core";

export type UserListFilters = {
  q?: string;
  role: "all" | "user" | "admin";
  status: "all" | "active" | "disabled";
  creator?: boolean;
  signIn?: "google" | "password" | "google-only" | "password-only";
  locked?: boolean;
  sort: "newest" | "oldest" | "uploads" | "downloads" | "likes" | "name";
  limit: number;
  offset: number;
};

// Live counts (the users.total_* counters are kept for the public profile; these are exact).
const uploadsCount = sql<number>`(SELECT count(*)::int FROM wallpapers w WHERE w.uploader_id = ${sql.raw(`"users"."id"`)})`;
const downloadsCount = sql<number>`(SELECT count(*)::int FROM downloads d WHERE d.user_id = ${sql.raw(`"users"."id"`)})`;
const likesCount = sql<number>`(SELECT count(*)::int FROM likes l WHERE l.user_id = ${sql.raw(`"users"."id"`)})`;
const lastActive = sql<Date | null>`GREATEST(
  (SELECT max(d.created_at) FROM downloads d WHERE d.user_id = ${sql.raw(`"users"."id"`)}),
  (SELECT max(l.created_at) FROM likes l WHERE l.user_id = ${sql.raw(`"users"."id"`)}),
  (SELECT max(w.created_at) FROM wallpapers w WHERE w.uploader_id = ${sql.raw(`"users"."id"`)}))`;

const isLocked = sql<boolean>`(${users.lockedUntil} IS NOT NULL AND ${users.lockedUntil} > now())`;

const listSelect = {
  id: users.id,
  email: users.email,
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  role: users.role,
  isCreator: users.isCreator,
  isEmailVerified: users.isEmailVerified,
  hasPassword: sql<boolean>`(${users.passwordHash} IS NOT NULL)`,
  hasGoogle: sql<boolean>`(${users.googleId} IS NOT NULL)`,
  locked: isLocked,
  disabled: sql<boolean>`(${users.disabledAt} IS NOT NULL)`,
  disabledAt: users.disabledAt,
  disabledReason: users.disabledReason,
  lockedUntil: users.lockedUntil,
  failedLoginAttempts: users.failedLoginAttempts,
  uploads: uploadsCount,
  downloads: downloadsCount,
  likes: likesCount,
  lastActiveAt: lastActive,
  createdAt: users.createdAt,
};

export async function listUsers(f: UserListFilters) {
  const where: SQL[] = [];
  if (f.q) {
    const p = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(users.email, p), ilike(users.username, p), ilike(users.displayName, p))!);
  }
  if (f.role !== "all") where.push(eq(users.role, f.role));
  if (f.status === "active") where.push(isNull(users.disabledAt));
  if (f.status === "disabled") where.push(isNotNull(users.disabledAt));
  if (f.creator !== undefined) where.push(eq(users.isCreator, f.creator));
  if (f.signIn === "google") where.push(isNotNull(users.googleId));
  if (f.signIn === "password") where.push(isNotNull(users.passwordHash));
  if (f.signIn === "google-only") where.push(and(isNotNull(users.googleId), isNull(users.passwordHash))!);
  if (f.signIn === "password-only") where.push(and(isNull(users.googleId), isNotNull(users.passwordHash))!);
  if (f.locked === true) where.push(and(isNotNull(users.lockedUntil), gt(users.lockedUntil, sql`now()`))!);
  if (f.locked === false) where.push(or(isNull(users.lockedUntil), sql`${users.lockedUntil} <= now()`)!);

  const order = {
    newest: [desc(users.createdAt)],
    oldest: [asc(users.createdAt)],
    uploads: [desc(uploadsCount), desc(users.createdAt)],
    downloads: [desc(downloadsCount), desc(users.createdAt)],
    likes: [desc(likesCount), desc(users.createdAt)],
    name: [asc(sql`lower(${users.displayName})`)],
  }[f.sort];

  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    db.select(listSelect).from(users).where(cond).orderBy(...order).limit(f.limit).offset(f.offset),
    db.select({ total: sql<number>`count(*)::int` }).from(users).where(cond),
  ]);
  return { data: rows, total, hasMore: f.offset + rows.length < total };
}

async function getRow(id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) throw new ApiError(404, "User not found");
  return u;
}

export async function getUserDetail(id: string) {
  const [user] = await db.select(listSelect).from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new ApiError(404, "User not found");
  const disabler = alias(users, "disabler");
  const [profile] = await db
    .select({ bio: users.bio, coverUrl: users.coverUrl, usernameChangedAt: users.usernameChangedAt, isPro: users.isPro, updatedAt: users.updatedAt, disabledByEmail: disabler.email })
    .from(users)
    .leftJoin(disabler, eq(disabler.id, users.disabledBy))
    .where(eq(users.id, id));
  const [{ hidden } = { hidden: 0 }] = await db
    .select({ hidden: sql<number>`count(*)::int` })
    .from(wallpapers)
    .where(and(eq(wallpapers.uploaderId, id), eq(wallpapers.status, "hidden")));
  const [{ live } = { live: 0 }] = await db
    .select({ live: sql<number>`count(*)::int` })
    .from(wallpapers)
    .where(and(eq(wallpapers.uploaderId, id), eq(wallpapers.status, "approved")));

  const [recentUploads, recentDownloads, recentLikes, [{ n: collectionsCount } = { n: 0 }], history] = await Promise.all([
    db
      .select({ id: wallpapers.id, title: wallpapers.title, fileUrl: wallpapers.fileUrl, dominantColor: wallpapers.dominantColor, status: wallpapers.status, category: categories.name, downloads: wallpapers.downloadCount, createdAt: wallpapers.createdAt })
      .from(wallpapers)
      .leftJoin(categories, eq(categories.id, wallpapers.categoryId))
      .where(eq(wallpapers.uploaderId, id))
      .orderBy(desc(wallpapers.createdAt))
      .limit(12),
    db
      .select({ wallpaperId: downloads.wallpaperId, title: wallpapers.title, fileUrl: wallpapers.fileUrl, dominantColor: wallpapers.dominantColor, quality: downloads.quality, source: downloads.source, at: downloads.createdAt })
      .from(downloads)
      .innerJoin(wallpapers, eq(wallpapers.id, downloads.wallpaperId))
      .where(eq(downloads.userId, id))
      .orderBy(desc(downloads.createdAt))
      .limit(10),
    db
      .select({ wallpaperId: likes.wallpaperId, title: wallpapers.title, fileUrl: wallpapers.fileUrl, dominantColor: wallpapers.dominantColor, at: likes.createdAt })
      .from(likes)
      .innerJoin(wallpapers, eq(wallpapers.id, likes.wallpaperId))
      .where(eq(likes.userId, id))
      .orderBy(desc(likes.createdAt))
      .limit(10),
    db.select({ n: sql<number>`count(*)::int` }).from(collections).where(eq(collections.userId, id)),
    db
      .select({ action: adminActions.action, details: adminActions.details, at: adminActions.createdAt, adminEmail: users.email })
      .from(adminActions)
      .leftJoin(users, eq(users.id, adminActions.adminId))
      .where(and(eq(adminActions.targetType, "user"), eq(adminActions.targetId, id)))
      .orderBy(desc(adminActions.createdAt))
      .limit(20),
  ]);

  return { ...user, ...profile, liveUploads: live, hiddenUploads: hidden, collections: collectionsCount, recentUploads, recentDownloads, recentLikes, history };
}

/** Admin accounts are managed with the script, never from the dashboard. */
function assertManageable(target: { id: string; role: string }, adminId: string) {
  if (target.id === adminId) throw new ApiError(403, "You can't change your own account here.");
  if (target.role === "admin") throw new ApiError(403, "Admin accounts can't be changed here.");
}

export async function setCreator(adminId: string, id: string, isCreator: boolean) {
  const u = await getRow(id);
  assertManageable(u, adminId);
  if (u.isCreator !== isCreator) {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ isCreator, updatedAt: new Date() }).where(eq(users.id, id));
      await logAdminAction({ adminId, action: isCreator ? "user.creator.grant" : "user.creator.revoke", targetType: "user", targetId: id, details: { email: u.email } }, tx);
    });
  }
  return getUserDetail(id);
}

export async function unlockUser(adminId: string, id: string) {
  const u = await getRow(id);
  assertManageable(u, adminId);
  const wasLocked = !!u.lockedUntil && u.lockedUntil > new Date();
  if (wasLocked || u.failedLoginAttempts > 0) {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, id));
      await logAdminAction({ adminId, action: "user.unlock", targetType: "user", targetId: id, details: { email: u.email, wasLocked, failedAttempts: u.failedLoginAttempts } }, tx);
    });
  }
  return getUserDetail(id);
}

/**
 * Disable: no sign-in by any route, sessions stop working (requireAuth checks the account),
 * and the user's live wallpapers are hidden. Reversible with enableUser.
 */
export async function disableUser(adminId: string, id: string, reason: string) {
  const u = await getRow(id);
  assertManageable(u, adminId);
  if (u.disabledAt) throw new ApiError(409, "This account is already disabled.");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ disabledAt: new Date(), disabledReason: reason, disabledBy: adminId, updatedAt: new Date() }).where(eq(users.id, id));
    const hidden = await tx
      .update(wallpapers)
      .set({ status: "hidden", updatedAt: new Date() })
      .where(and(eq(wallpapers.uploaderId, id), eq(wallpapers.status, "approved")))
      .returning({ id: wallpapers.id });
    await logAdminAction({ adminId, action: "user.disable", targetType: "user", targetId: id, details: { email: u.email, reason, wallpapersHidden: hidden.length } }, tx);
  });
  forgetAccountStatus(id);
  return getUserDetail(id);
}

export async function enableUser(adminId: string, id: string) {
  const u = await getRow(id);
  assertManageable(u, adminId);
  if (!u.disabledAt) throw new ApiError(409, "This account isn't disabled.");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ disabledAt: null, disabledReason: null, disabledBy: null, updatedAt: new Date() }).where(eq(users.id, id));
    const restored = await tx
      .update(wallpapers)
      .set({ status: "approved", updatedAt: new Date() })
      .where(and(eq(wallpapers.uploaderId, id), eq(wallpapers.status, "hidden")))
      .returning({ id: wallpapers.id });
    await logAdminAction({ adminId, action: "user.enable", targetType: "user", targetId: id, details: { email: u.email, wallpapersRestored: restored.length, wasDisabledFor: u.disabledReason } }, tx);
  });
  forgetAccountStatus(id);
  return getUserDetail(id);
}

/** Same cleanup as a user deleting their own account. The admin must type the email to confirm. */
export async function deleteUser(adminId: string, id: string, confirmEmail: string) {
  const u = await getRow(id);
  assertManageable(u, adminId);
  if (confirmEmail.trim().toLowerCase() !== u.email.toLowerCase()) throw new ApiError(400, "The email doesn't match. Type the user's email to confirm.");
  const { uploadsRemoved } = await purgeAccount(u);
  forgetAccountStatus(id);
  // Logged after the purge: the row outlives the user (admin_actions keeps target ids as text).
  await logAdminAction({ adminId, action: "user.delete", targetType: "user", targetId: id, details: { email: u.email, username: u.username, uploadsRemoved } });
  return { id, deleted: true as const, uploadsRemoved };
}
