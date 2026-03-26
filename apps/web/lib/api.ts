const API_URL = process.env.NEXT_PUBLIC_API_URL; 

export async function getWallpapers() {
  const response = await fetch(`${API_URL}/api/wallpapers`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch wallpapers"); 
  const { data } = await response.json(); 
  return data; 
}

export async function getWallpaperById(id:string) {
  const response = await fetch(`${API_URL}/api/wallpapers/${id}`, { cache: "no-store" }); 

  if (!response.ok) throw new Error("Failed to fetch wallpaper"); 
  const { data } = await response.json(); 
  return data; 
}