import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../config/db";
import { likes, wallpapers } from "../models";

/** Like if not liked, unlike if liked; keeps wallpapers.like_count in sync. */
export async function toggleLike(userId: string, wallpaperId: string): Promise<boolean> {
  const where = and(eq(likes.userId, userId), eq(likes.wallpaperId, wallpaperId));
  const existing = await db.select().from(likes).where(where).limit(1);

  if (existing.length > 0) {
    await db.delete(likes).where(where);
    await db
      .update(wallpapers)
      .set({ likeCount: sql`${wallpapers.likeCount} - 1` })
      .where(eq(wallpapers.id, wallpaperId));
    return false;
  }

  await db.insert(likes).values({ userId, wallpaperId });
  await db
    .update(wallpapers)
    .set({ likeCount: sql`${wallpapers.likeCount} + 1` })
    .where(eq(wallpapers.id, wallpaperId));
  return true;
}

export function listLikedWallpapers(userId: string) {
  return db
    .select({
      id: wallpapers.id,
      title: wallpapers.title,
      fileUrl: wallpapers.fileUrl,
      blurhash: wallpapers.blurhash,
      dominantColor: wallpapers.dominantColor,
      width: wallpapers.width,
      height: wallpapers.height,
      likeCount: wallpapers.likeCount,
      downloadCount: wallpapers.downloadCount,
      likedAt: likes.createdAt,
    })
    .from(likes)
    .innerJoin(wallpapers, eq(likes.wallpaperId, wallpapers.id))
    .where(eq(likes.userId, userId))
    .orderBy(desc(likes.createdAt));
}

export async function isLiked(userId: string, wallpaperId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.wallpaperId, wallpaperId)))
    .limit(1);
  return rows.length > 0;
}
