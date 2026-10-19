import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../config/db";
import { users, wallpapers } from "../models";
import { getFileBytes, keyFromPublicUrl } from "../integrations/r2";
import { computePhash, pixelSignature, signatureSimilarity } from "../utils/phash";
import { heavyImageWork, thumbUrlSql } from "./wallpaperThumb.service";

/**
 * Duplicate detection, two tests that must both agree (tuned on our own wallpapers):
 * 1. pHash distance (utils/phash) finds candidates fast in the database;
 * 2. pixel similarity (32×32 greyscale correlation) confirms them — different images with a similar
 *    layout can have close pHashes (seen at distance 6 with similarity 0.34), the same picture can't.
 * Measured: resized / re-compressed / brightened / blurred copies → distance ≤ 8 and similarity ≥ 0.937;
 * an 8–15 % crop → distance 6–20 and similarity 0.52–0.96; unrelated pairs → similarity ≤ 0.72.
 */
export const DUPLICATE_RULES = {
  /** Same picture → the upload is blocked */
  block: { distance: 8, similarity: 0.92 },
  /** Probably an edited copy (e.g. cropped) → allowed, but goes to the admin review queue */
  review: { distance: 14, similarity: 0.8 },
  /** How many pHash candidates get the pixel test */
  candidates: 5,
};

export type DuplicateMatch = {
  id: string;
  title: string;
  thumbUrl: string | null;
  uploaderId: string | null;
  uploaderUsername: string | null;
  distance: number;
  similarity: number;
  /** "block": same picture · "review": very similar */
  level: "block" | "review";
};

/** Fingerprint + pixel signature of an image, from its bytes. */
export async function fingerprint(image: Buffer): Promise<{ phash: string; signature: string }> {
  const [phash, signature] = await Promise.all([computePhash(image), pixelSignature(image)]);
  return { phash, signature };
}

/** Bytes of an image we host (from the bucket), or anywhere else by URL. */
async function readImage(url: string): Promise<Buffer | null> {
  const key = keyFromPublicUrl(url);
  if (key) return getFileBytes(key);
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

/**
 * The live or waiting wallpaper this image duplicates, if any (rejected ones don't count —
 * they're not on Aurora). `excludeId` skips the wallpaper itself.
 */
export async function findImageDuplicate(
  print: { phash: string; signature: string },
  excludeId?: string
): Promise<DuplicateMatch | null> {
  const distance = sql<number>`bit_count((${wallpapers.phash} # ${print.phash}::bigint)::bit(64))::int`;
  const candidates = await db
    .select({
      id: wallpapers.id,
      title: wallpapers.title,
      thumbUrl: sql<string | null>`coalesce(${thumbUrlSql}, ${wallpapers.fileUrl})`,
      uploaderId: wallpapers.uploaderId,
      uploaderUsername: users.username,
      distance,
    })
    .from(wallpapers)
    .leftJoin(users, eq(users.id, wallpapers.uploaderId))
    .where(and(
      sql`${wallpapers.phash} IS NOT NULL`,
      sql`${wallpapers.status} IN ('approved', 'pending')`,
      sql`${distance} <= ${DUPLICATE_RULES.review.distance}`,
      excludeId ? ne(wallpapers.id, excludeId) : undefined
    ))
    .orderBy(distance)
    .limit(DUPLICATE_RULES.candidates);

  let best: DuplicateMatch | null = null;
  for (const c of candidates) {
    let similarity = 0;
    try {
      const bytes = c.thumbUrl ? await readImage(c.thumbUrl) : null;
      if (!bytes) continue;
      similarity = signatureSimilarity(print.signature, await pixelSignature(bytes));
    } catch (e) {
      console.error("[duplicates] couldn't compare with", c.id, e instanceof Error ? e.message : e);
      continue;
    }
    const { block, review } = DUPLICATE_RULES;
    if (c.distance <= block.distance && similarity >= block.similarity) {
      return { ...c, similarity, level: "block" };
    }
    if (similarity >= review.similarity && (!best || similarity > best.similarity)) {
      best = { ...c, similarity, level: "review" };
    }
  }
  return best;
}

/** Fingerprint of an existing wallpaper — from its thumbnail when there is one (same hash, far less to download). */
async function phashOf(fileUrl: string, thumbUrl: string | null): Promise<string | null> {
  return heavyImageWork(async () => {
    const bytes = await readImage(thumbUrl ?? fileUrl);
    return bytes ? computePhash(bytes) : null;
  });
}

/** Fill fingerprints for wallpapers that don't have one yet (rows from before duplicate detection). */
export async function fillMissingPhashes(limit = 100, concurrency = 4) {
  const rows = await db
    .select({ id: wallpapers.id, fileUrl: wallpapers.fileUrl, thumbUrl: thumbUrlSql })
    .from(wallpapers)
    .where(isNull(wallpapers.phash))
    .limit(limit);
  let filled = 0;
  let failed = 0;
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        try {
          const phash = await phashOf(r.fileUrl, r.thumbUrl);
          if (!phash) { failed++; continue; }
          await db.update(wallpapers).set({ phash }).where(eq(wallpapers.id, r.id));
          filled++;
        } catch (e) {
          failed++;
          console.error("[phash] failed:", r.id, e instanceof Error ? e.message : e);
        }
      }
    })
  );
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(wallpapers).where(isNull(wallpapers.phash))) as [{ n: number }];
  return { filled, failed, remaining: n };
}
