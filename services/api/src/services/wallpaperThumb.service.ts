import sharp from "sharp";
import { and, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../config/db";
import { wallpapers } from "../models";
import { deleteFile, getFileBytes, keyFromPublicUrl, uploadFileToKey } from "../integrations/r2";
import { extractImageMetadataFromBuffer, type ImageMetadata } from "../utils/imageMetadata";
import { createSemaphore } from "../utils/semaphore";
import { computePhash, pixelSignature } from "../utils/phash";

/**
 * Full-size image work (download + decode) is memory-heavy: a 5K PNG is ~60 MB once decoded.
 * Every caller goes through this gate, so however many uploads arrive at once, at most two
 * images are in memory at the same time.
 */
export const heavyImageWork = createSemaphore(2);

/**
 * Small WebP copies of wallpapers for grids and cards (the originals are 1–6 MB).
 * Stored at a key derived from the original's key, so it can always be found and
 * deleted with it:  wallpapers/x/abc.jpg  →  thumbs/wallpapers/x/abc.webp
 * Saved on the row as cdn_variants.thumb = { url, width, height, bytes }.
 */
export const THUMB_WIDTH = 600;
const THUMB_QUALITY = 72;

export type ThumbVariant = { url: string; width: number; height: number; bytes: number };

/** `thumbUrl` column for selects: the thumbnail, or null until one exists. */
export const thumbUrlSql = sql<string | null>`(${sql.raw(`"wallpapers"."cdn_variants"`)} -> 'thumb' ->> 'url')`;

export function thumbKeyFor(fileKey: string): string {
  return `thumbs/${fileKey.replace(/\.[a-z0-9]+$/i, "")}.webp`;
}

export async function renderThumb(image: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(image, { failOn: "none", limitInputPixels: false })
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Make and upload the thumbnail for one of our files. Null if the URL isn't ours. */
export async function createThumb(fileUrl: string, source?: Buffer): Promise<ThumbVariant | null> {
  const key = keyFromPublicUrl(fileUrl);
  if (!key) return null;
  const { data, width, height } = await renderThumb(source ?? (await getFileBytes(key)));
  const url = await uploadFileToKey(thumbKeyFor(key), data, "image/webp", "public, max-age=31536000, immutable");
  return { url, width, height, bytes: data.length };
}

/** createThumb that never throws (uploads must not fail because of a thumbnail). */
export async function tryCreateThumb(fileUrl: string): Promise<ThumbVariant | null> {
  try {
    return await createThumb(fileUrl);
  } catch (e) {
    console.error("[thumbs] create failed (will retry hourly):", fileUrl, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Value for wallpapers.cdn_variants with the thumbnail merged in. */
export function withThumb(thumb: ThumbVariant) {
  return sql`COALESCE(${sql.raw(`"cdn_variants"`)}, '{}'::jsonb) || jsonb_build_object('thumb', ${JSON.stringify(thumb)}::jsonb)`;
}

/** Remove the thumbnail that belongs to an original (best effort). */
export async function deleteThumbFor(fileUrl: string | null | undefined): Promise<void> {
  const key = keyFromPublicUrl(fileUrl);
  if (!key) return;
  await deleteFile(thumbKeyFor(key)).catch((e) => console.error("[thumbs] delete failed (non-fatal):", e instanceof Error ? e.message : e));
}

/** Make thumbnails for wallpapers that don't have one yet (new uploads that failed, old rows). */
export async function fillMissingThumbs(limit = 40, concurrency = 4): Promise<{ created: number; failed: number; remaining: number }> {
  const missing = sql`(${sql.raw(`"wallpapers"."cdn_variants"`)} -> 'thumb') IS NULL`;
  const rows = await db
    .select({ id: wallpapers.id, fileUrl: wallpapers.fileUrl })
    .from(wallpapers)
    .where(and(missing, isNotNull(wallpapers.fileUrl), inArray(wallpapers.status, ["approved", "pending", "hidden"])))
    .orderBy(sql`${wallpapers.createdAt} DESC`)
    .limit(limit);

  let created = 0;
  let failed = 0;
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const row = rows[i++]!;
      try {
        const thumb = await heavyImageWork(() => createThumb(row.fileUrl));
        if (!thumb) {
          failed++;
          continue;
        }
        await db.update(wallpapers).set({ cdnVariants: withThumb(thumb) }).where(sql`${wallpapers.id} = ${row.id}`);
        created++;
      } catch (e) {
        failed++;
        console.error("[thumbs]", row.id, e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));

  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(wallpapers)
    .where(and(missing, inArray(wallpapers.status, ["approved", "pending", "hidden"])));
  return { created, failed, remaining: n };
}

/**
 * For a file just uploaded to R2: download it once, read its size/colours, make its
 * thumbnail and its duplicate-detection fingerprint from the same bytes.
 * Width 0 in `metadata` = not a readable image.
 */
export async function prepareUploadedImage(
  key: string,
  fileUrl: string
): Promise<{ metadata: ImageMetadata; thumb: ThumbVariant | null; print: { phash: string; signature: string } | null }> {
  return heavyImageWork(async () => {
    let bytes: Buffer;
    try {
      bytes = await getFileBytes(key);
    } catch (e) {
      console.error("[upload] could not read the uploaded file:", key, e instanceof Error ? e.message : e);
      return { metadata: await extractImageMetadataFromBuffer(Buffer.alloc(0)), thumb: null, print: null };
    }
    const metadata = await extractImageMetadataFromBuffer(bytes);
    if (!metadata.width) return { metadata, thumb: null, print: null };
    const thumb = await createThumb(fileUrl, bytes).catch((e) => {
      console.error("[thumbs] create failed (will retry hourly):", fileUrl, e instanceof Error ? e.message : e);
      return null;
    });
    // Duplicate-detection fingerprint + pixel signature (services/duplicate.service)
    const print = await Promise.all([computePhash(bytes), pixelSignature(bytes)])
      .then(([phash, signature]) => ({ phash, signature }))
      .catch(() => null);
    return { metadata, thumb, print };
  });
}
