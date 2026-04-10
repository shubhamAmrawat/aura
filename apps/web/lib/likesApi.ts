const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function toggleLike(wallpaperId: string) {
  const response = await fetch(`${API_URL}/api/likes/${wallpaperId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to toggle like");
  return data; // { liked: boolean }
}

export async function checkLike(wallpaperId: string) {
  const response = await fetch(`${API_URL}/api/likes/${wallpaperId}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to check like");
  return data; // { liked: boolean }
}

export async function getLikedWallpapers() {
  const response = await fetch(`${API_URL}/api/likes`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to fetch liked wallpapers");
  return data.data;
}


export async function getLikedWallpaperIds(): Promise<Set<string>> {
  try {
    const response = await fetch(`${API_URL}/api/likes`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) return new Set();
    return new Set(data.data.map((w: { id: string }) => w.id));
  } catch {
    return new Set();
  }
}
