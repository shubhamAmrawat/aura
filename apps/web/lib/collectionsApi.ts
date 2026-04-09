const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface Collection {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  coverWallpaperId: string | null;
  coverUrl: string | null;
  createdAt: string;
  wallpaperCount: number;
}

export interface CollectionCheck {
  id: string;
  title: string;
  isPublic: boolean;
  hasWallpaper: boolean;
}

export async function getUserCollections(token: string): Promise<Collection[]> {
  const response = await fetch(`${API_URL}/api/collections`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to fetch collections");
  return data.data;
}

export async function createCollection(
  token: string,
  payload: { title: string; description?: string; isPublic: boolean }
): Promise<Collection> {
  const response = await fetch(`${API_URL}/api/collections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to create collection");
  return data.collection;
}

export async function addToCollection(
  token: string,
  collectionId: string,
  wallpaperId: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/collections/${collectionId}/wallpapers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallpaperId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to add to collection");
}

export async function removeFromCollection(
  token: string,
  collectionId: string,
  wallpaperId: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/collections/${collectionId}/wallpapers/${wallpaperId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to remove from collection");
}

export async function getSavedWallpaperIds(token: string): Promise<Set<string>> {
  try {
    const response = await fetch(`${API_URL}/api/collections/saved-ids`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) return new Set();
    return new Set(data.data as string[]);
  } catch {
    return new Set();
  }
}

export async function checkCollections(
  token: string,
  wallpaperId: string
): Promise<CollectionCheck[]> {
  const response = await fetch(
    `${API_URL}/api/collections/check/${wallpaperId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to check collections");
  return data.data;
}

export async function getCollection(token: string | null, collectionId: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/api/collections/${collectionId}`, {
    headers,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to fetch collection");
  return data;
}

export async function deleteCollection(token: string, collectionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/collections/${collectionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to delete collection");
}

export async function updateCollection(
  token: string,
  collectionId: string,
  payload: { title?: string; description?: string; isPublic?: boolean }
): Promise<Collection> {
  const response = await fetch(`${API_URL}/api/collections/${collectionId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to update collection");
  return data.collection;
}