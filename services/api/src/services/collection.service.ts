import { and, desc, eq, ne, sql } from "drizzle-orm";
import { visibleCategorySql } from "../utils/screenFilter";
import { db } from "../config/db";
import { collections, collectionWallpapers, wallpapers } from "../models";
import { ApiError } from "../utils/ApiError";
import { thumbUrlSql } from "./wallpaperThumb.service";

export function listPublicCollections() {
  return db
    .select({
      id: collections.id,
      title: collections.title,
      description: collections.description,
      coverWallpaperId: collections.coverWallpaperId,
      userId: collections.userId,
      createdAt: collections.createdAt,
      wallpaperCount: sql<number>`count(${collectionWallpapers.wallpaperId})::int`,
    })
    .from(collections)
    .leftJoin(collectionWallpapers, eq(collections.id, collectionWallpapers.collectionId))
    .where(eq(collections.isPublic, true))
    .groupBy(collections.id)
    .orderBy(desc(collections.createdAt));
}

/** Unique wallpaper IDs saved across all of the user's collections. */
export async function listSavedWallpaperIds(userId: string) {
  const rows = await db
    .selectDistinct({ wallpaperId: collectionWallpapers.wallpaperId })
    .from(collectionWallpapers)
    .innerJoin(collections, eq(collectionWallpapers.collectionId, collections.id))
    .where(eq(collections.userId, userId));
  return rows.map((r) => r.wallpaperId);
}

/** A collection + its wallpapers. Private collections are visible to the owner only. */
export async function getCollection(id: string, viewerId: string | undefined) {
  const [collection] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  if (!collection) throw new ApiError(404, "Collection not found");

  if (!collection.isPublic) {
    if (!viewerId || viewerId !== collection.userId) {
      throw new ApiError(401, "Unauthorized");
    }
  }

  const items = await db
    .select({
      id: wallpapers.id,
      title: wallpapers.title,
      fileUrl: wallpapers.fileUrl,
      thumbUrl: thumbUrlSql,
      blurhash: wallpapers.blurhash,
      dominantColor: wallpapers.dominantColor,
      width: wallpapers.width,
      height: wallpapers.height,
      likeCount: wallpapers.likeCount,
      downloadCount: wallpapers.downloadCount,
      addedAt: collectionWallpapers.addedAt,
    })
    .from(collectionWallpapers)
    .innerJoin(wallpapers, eq(collectionWallpapers.wallpaperId, wallpapers.id))
    .where(and(eq(collectionWallpapers.collectionId, id), ne(wallpapers.status, "hidden"), visibleCategorySql)) // hidden = uploader disabled
    .orderBy(desc(collectionWallpapers.addedAt));

  return { collection: { ...collection, wallpaperCount: items.length }, wallpapers: items };
}

export function listUserCollections(userId: string) {
  return db
    .select({
      id: collections.id,
      title: collections.title,
      description: collections.description,
      isPublic: collections.isPublic,
      coverWallpaperId: collections.coverWallpaperId,
      coverUrl: sql<string | null>`(
        SELECT file_url FROM wallpapers WHERE id = ${collections.coverWallpaperId} LIMIT 1
      )`,
      createdAt: collections.createdAt,
      wallpaperCount: sql<number>`count(${collectionWallpapers.wallpaperId})::int`,
    })
    .from(collections)
    .leftJoin(collectionWallpapers, eq(collections.id, collectionWallpapers.collectionId))
    .where(eq(collections.userId, userId))
    .groupBy(collections.id)
    .orderBy(desc(collections.createdAt));
}

export async function createCollection(userId: string, input: { title: string; description?: any; isPublic?: any }) {
  const [created] = await db
    .insert(collections)
    .values({
      userId,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      isPublic: input.isPublic ?? false,
    })
    .returning();
  if (!created) throw new ApiError(500, "Failed to create collection");
  return created;
}

async function findOwnedCollection(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)))
    .limit(1);
  if (!row) throw new ApiError(404, "Collection not found");
  return row;
}

export async function updateCollection(userId: string, id: string, input: { title?: any; description?: any; isPublic?: any }) {
  await findOwnedCollection(userId, id);

  const updates: Record<string, any> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() ?? null;
  if (input.isPublic !== undefined) updates.isPublic = input.isPublic;

  const updated = await db.update(collections).set(updates).where(eq(collections.id, id)).returning();
  return updated[0];
}

export async function deleteCollection(userId: string, id: string) {
  await findOwnedCollection(userId, id);
  await db.delete(collectionWallpapers).where(eq(collectionWallpapers.collectionId, id));
  await db.delete(collections).where(eq(collections.id, id));
}

/** Add a wallpaper; the first one added becomes the cover. */
export async function addWallpaper(userId: string, collectionId: string, wallpaperId: string) {
  const collection = await findOwnedCollection(userId, collectionId);

  const existing = await db
    .select()
    .from(collectionWallpapers)
    .where(and(eq(collectionWallpapers.collectionId, collectionId), eq(collectionWallpapers.wallpaperId, wallpaperId)))
    .limit(1);
  if (existing.length > 0) throw new ApiError(409, "Wallpaper already in collection");

  await db.insert(collectionWallpapers).values({ collectionId, wallpaperId });

  if (!collection.coverWallpaperId) {
    await db.update(collections).set({ coverWallpaperId: wallpaperId }).where(eq(collections.id, collectionId));
  }
}

/** Remove a wallpaper; if it was the cover, the most recently added remaining one becomes the cover. */
export async function removeWallpaper(userId: string, collectionId: string, wallpaperId: string) {
  const collection = await findOwnedCollection(userId, collectionId);

  await db
    .delete(collectionWallpapers)
    .where(and(eq(collectionWallpapers.collectionId, collectionId), eq(collectionWallpapers.wallpaperId, wallpaperId)));

  if (collection.coverWallpaperId === wallpaperId) {
    const [next] = await db
      .select()
      .from(collectionWallpapers)
      .where(eq(collectionWallpapers.collectionId, collectionId))
      .orderBy(desc(collectionWallpapers.addedAt))
      .limit(1);
    await db
      .update(collections)
      .set({ coverWallpaperId: next?.wallpaperId ?? null })
      .where(eq(collections.id, collectionId));
  }
}

/** The user's collections, each flagged with whether it contains the wallpaper. */
export function checkWallpaperInCollections(userId: string, wallpaperId: string) {
  return db
    .select({
      id: collections.id,
      title: collections.title,
      isPublic: collections.isPublic,
      hasWallpaper: sql<boolean>`
        exists(
          select 1 from ${collectionWallpapers}
          where ${collectionWallpapers.collectionId} = ${collections.id}
          and ${collectionWallpapers.wallpaperId} = ${wallpaperId}
        )
      `,
    })
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(desc(collections.createdAt));
}
