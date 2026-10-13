/**
 * Write page descriptions for live wallpapers whose description is missing or under 80 characters.
 *   npx tsx --env-file=../../.env scripts/wallpaper-descriptions.ts            → dry run: 5 samples, nothing saved
 *   npx tsx --env-file=../../.env scripts/wallpaper-descriptions.ts --apply    → write them all
 *   ... --apply --limit=100                                                     → at most 100
 * Hidden categories are skipped (they are not on the public site).
 */
import { eq } from "drizzle-orm";
import { db } from "../src/config/db";
import { wallpapers } from "../src/models";
import { countNeedingDescription, generateDescription, listNeedingDescription } from "../src/services/wallpaperDescription.service";

async function main() {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const total = await countNeedingDescription();
  const limit = apply ? Math.min(total, limitArg ? Number(limitArg.split("=")[1]) : total) : Math.min(5, total);
  console.log(`${total} live wallpapers need a description. ${apply ? `Writing ${limit}…` : "Dry run — 5 samples, nothing saved:"}`);

  const rows = await listNeedingDescription(limit);
  let written = 0;
  let failed = 0;
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const row = rows[i++]!;
      const description = await generateDescription({
        imageUrl: row.thumbUrl ?? row.fileUrl,
        title: row.title,
        tags: row.tags ?? [],
        isMobile: row.isMobile,
      });
      if (!description) {
        failed++;
        console.log(`  ✗ ${row.title}`);
        continue;
      }
      if (apply) {
        await db.update(wallpapers).set({ description, updatedAt: new Date() }).where(eq(wallpapers.id, row.id));
      } else {
        console.log(`\n• ${row.title}\n  before: ${row.description ?? "(none)"}\n  after:  ${description}`);
      }
      written++;
      if (apply && written % 50 === 0) console.log(`  ${written}/${rows.length}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`\nDone: ${written} ${apply ? "written" : "generated"}, ${failed} failed.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
