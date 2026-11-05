import sharp from "sharp";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../config/db";
import { env } from "../config/env";
import { users } from "../models";
import { uploadFileToKey } from "../integrations/r2";
import { avatarSvg, randomSeed, type AvatarStyle } from "../utils/avatarPack";

/**
 * Aurora's avatar pack as images. A chosen avatar is drawn once as a PNG and kept in R2 under
 * avatar-pack/ (shared: the same style + seed is the same picture for anyone), so profile
 * pictures load from the CDN like uploaded photos. Previews for the pickers come from the API.
 */

export const PACK_FOLDER = "avatar-pack";
const PROFILE_SIZE = 256;

/** Pack images are never per-user: account deletion and photo changes must leave them alone. */
export const isPackKey = (key: string | null | undefined) => !!key && key.startsWith(`${PACK_FOLDER}/`);

export async function avatarPng(style: AvatarStyle, seed: number, size: number) {
  return sharp(Buffer.from(avatarSvg(style, seed)), { density: Math.max(72, Math.ceil((72 * size) / 100)) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Draws it into R2 (idempotent) and returns its public URL. */
export async function storePackAvatar(style: AvatarStyle, seed: number): Promise<string> {
  if (!env.R2_PUBLIC_URL) throw new Error("Image storage is not configured.");
  const key = `${PACK_FOLDER}/${style}-${seed >>> 0}.png`;
  return uploadFileToKey(key, await avatarPng(style, seed, PROFILE_SIZE), "image/png", "public, max-age=31536000, immutable");
}

/** A random Night critter for someone without a profile picture (does nothing if they have one). */
export async function assignDefaultAvatar(userId: string) {
  const url = await storePackAvatar("critter", randomSeed());
  const [row] = await db
    .update(users)
    .set({ avatarUrl: url })
    .where(and(eq(users.id, userId), isNull(users.avatarUrl)))
    .returning({ id: users.id });
  return row ? url : null;
}

/** Background version for sign-up: never throws, never delays the response. */
export function assignDefaultAvatarLater(userId: string) {
  void assignDefaultAvatar(userId).catch((e) => console.error("[avatars] default avatar failed:", e instanceof Error ? e.message : e));
}
