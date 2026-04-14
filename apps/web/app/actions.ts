"use server";

import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Bust all wallpaper feed caches immediately.
 * Called after a successful upload so the new wallpaper appears on
 * the homepage, /latest, and /trending without waiting for revalidation TTLs.
 */
export async function revalidateFeeds() {
  revalidateTag("wallpapers");
  revalidatePath("/");
  revalidatePath("/latest");
  revalidatePath("/trending");
}
