import { buildObjectKey, uploadFileToKey } from "./r2";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 5000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isGoogleAvatarUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

/**
 * Copy a Google profile photo into our R2 bucket (Google's links get throttled
 * when hot-linked and can change). Returns the R2 URL, or null on any failure.
 */
export async function importGoogleAvatar(pictureUrl: string, userId: string): Promise<string | null> {
  try {
    if (!isGoogleAvatarUrl(pictureUrl)) return null;
    // Ask for a 256px square instead of the default 96px.
    const url = pictureUrl.replace(/=s\d+(-c)?$/, "=s256-c");
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!ALLOWED.has(type)) return null;
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length === 0 || body.length > MAX_BYTES) return null;
    return await uploadFileToKey(buildObjectKey("avatars", type, userId), body, type);
  } catch (err) {
    console.error("[avatar] Google avatar import failed:", err);
    return null;
  }
}
