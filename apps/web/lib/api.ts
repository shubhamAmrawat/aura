const API_URL = process.env.NEXT_PUBLIC_API_URL; 

export async function getWallpapers(params?: {
  category?: string;
  q?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.q) query.set("q", params.q);
  if (params?.limit) query.set("limit", String(params.limit));

  const url = `${API_URL}/api/wallpapers${query.toString() ? `?${query}` : ""}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch wallpapers");
  const { data } = await response.json();
  return data;
}
export async function getFeaturedWallpapers() {
  const response = await fetch(
    `${API_URL}/api/wallpapers?featured=true&limit=5`,
    { cache: "no-store" }
  );
  if (!response.ok) throw new Error("Failed to fetch featured wallpapers");
  const { data } = await response.json();
  console.log("Data from featured walls", data);
  return data;
}
export async function getWallpaperById(id:string) {
  const response = await fetch(`${API_URL}/api/wallpapers/${id}`, { cache: "no-store" }); 

  if (!response.ok) throw new Error("Failed to fetch wallpaper"); 
  const { data } = await response.json(); 
  return data; 
}

export async function getCategories() {
  const response = await fetch(`${API_URL}/api/categories`, { cache: "force-cache" }); 
  if (!response.ok) throw new Error("Failed to fetch wallpaper"); 
  const { data } = await response.json(); 
  return data; 
}