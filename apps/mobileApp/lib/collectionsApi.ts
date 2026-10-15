import { request, WallpaperTile } from "./api";

/** A user's collection as listed in Library. */
export type Collection = {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  coverWallpaperId: string | null;
  coverUrl: string | null;
  coverThumbUrl?: string | null;
  createdAt: string;
  wallpaperCount: number;
};

/** A collection row in the save sheet: does it already hold this wallpaper? */
export type CollectionCheck = { id: string; title: string; isPublic: boolean; hasWallpaper: boolean };

export type CollectionDetails = {
  collection: Omit<Collection, "coverUrl" | "coverThumbUrl"> & { userId: string };
  wallpapers: WallpaperTile[];
};

export async function getMyCollections(): Promise<Collection[]> {
  const res = await request<{ data: Collection[] }>("/api/collections");
  return res.data ?? [];
}

export function getCollection(id: string): Promise<CollectionDetails> {
  return request<CollectionDetails>(`/api/collections/${id}`);
}

export async function getCollectionsForWallpaper(wallpaperId: string): Promise<CollectionCheck[]> {
  const res = await request<{ data: CollectionCheck[] }>(`/api/collections/check/${wallpaperId}`);
  return res.data ?? [];
}

export async function createCollection(input: { title: string; isPublic: boolean; description?: string | null }): Promise<Collection> {
  const res = await request<{ collection: Collection }>("/api/collections", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.collection;
}

export async function updateCollection(
  id: string,
  patch: { title?: string; description?: string | null; isPublic?: boolean }
): Promise<Collection> {
  const res = await request<{ collection: Collection }>(`/api/collections/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return res.collection;
}

export async function deleteCollection(id: string): Promise<void> {
  await request(`/api/collections/${id}`, { method: "DELETE" });
}

export async function addToCollection(collectionId: string, wallpaperId: string): Promise<void> {
  await request(`/api/collections/${collectionId}/wallpapers`, {
    method: "POST",
    body: JSON.stringify({ wallpaperId }),
  });
}

export async function removeFromCollection(collectionId: string, wallpaperId: string): Promise<void> {
  await request(`/api/collections/${collectionId}/wallpapers/${wallpaperId}`, { method: "DELETE" });
}

/** Ids of every wallpaper in any of the user's collections (for the filled bookmark). */
export async function getSavedWallpaperIds(): Promise<string[]> {
  const res = await request<{ data: string[] }>("/api/collections/saved-ids");
  return res.data ?? [];
}
