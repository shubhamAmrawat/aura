/**
 * Make the 600px WebP grid thumbnails for wallpapers that don't have one yet.
 * Safe to stop and re-run: it only picks rows still missing a thumbnail.
 *
 *   pnpm tsx --env-file=../../.env scripts/wallpaper-thumbs.ts            # dry run: how many are missing
 *   pnpm tsx --env-file=../../.env scripts/wallpaper-thumbs.ts --apply    # make them (batches of 40, 6 at a time)
 */
import { and, inArray, sql } from "drizzle-orm";
import { db } from "../src/config/db";
import { wallpapers } from "../src/models";
import { fillMissingThumbs } from "../src/services/wallpaperThumb.service";

const apply = process.argv.includes("--apply");

async function main() {
  const [{ total, missing, bytes }] = await db
    .select({
      total: sql<number>`count(*)::int`,
      missing: sql<number>`count(*) FILTER (WHERE (cdn_variants -> 'thumb') IS NULL)::int`,
      bytes: sql<number>`COALESCE(sum(file_size_bytes) FILTER (WHERE (cdn_variants -> 'thumb') IS NULL), 0)::bigint`,
    })
    .from(wallpapers)
    .where(and(inArray(wallpapers.status, ["approved", "pending", "hidden"])));
  console.log(`${missing} of ${total} wallpapers need a thumbnail (originals to read: ${(Number(bytes) / 1e9).toFixed(2)} GB).`);
  if (!apply) {
    console.log("Run with --apply to make them.");
    return;
  }

  const started = Date.now();
  let done = 0;
  let failedTotal = 0;
  for (;;) {
    const { created, failed, remaining } = await fillMissingThumbs(40, 6);
    done += created;
    failedTotal += failed;
    const secs = Math.round((Date.now() - started) / 1000);
    console.log(`  +${created} (failed ${failed}) — ${done} made, ${remaining} left, ${secs}s`);
    // Stop when nothing is left, or when a whole batch failed (don't loop on broken files).
    if (remaining === 0 || created === 0) break;
  }
  console.log(`Done: ${done} thumbnails made, ${failedTotal} failed.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
