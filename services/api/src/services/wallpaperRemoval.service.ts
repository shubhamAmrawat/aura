import { eq, sql } from "drizzle-orm";
import { db } from "../config/db";
import { collections, collectionWallpapers, downloads, likes, users, wallpapers } from "../models";
import { deleteFile, keyFromPublicUrl } from "../integrations/r2";
import { deleteThumbFor } from "./wallpaperThumb.service";

/**
 * Remove a wallpaper for good: dependents first, then the row, then its R2 file,
 * then the uploader's upload counter. Used by creator delete and the rejected purge.
 */
export async function removeWallpaper(row: { id: string; fileUrl: string; uploaderId: string | null }) {
  await Promise.all([
    db.delete(likes).where(eq(likes.wallpaperId, row.id)),
    db.delete(downloads).where(eq(downloads.wallpaperId, row.id)),
    db.delete(collectionWallpapers).where(eq(collectionWallpapers.wallpaperId, row.id)),
    db.update(collections).set({ coverWallpaperId: null }).where(eq(collections.coverWallpaperId, row.id)),
  ]);

  await db.delete(wallpapers).where(eq(wallpapers.id, row.id));

  const key = keyFromPublicUrl(row.fileUrl);
  if (key) {
    await deleteFile(key).catch((e) => console.error("[r2] Delete file failed (non-fatal):", e));
    await deleteThumbFor(row.fileUrl);
  }

  if (row.uploaderId) {
    await db
      .update(users)
      .set({ totalUploads: sql`GREATEST(${users.totalUploads} - 1, 0)` })
      .where(eq(users.id, row.uploaderId));
  }
}
