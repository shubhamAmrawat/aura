/**
 * Load the category descriptions + page intros from scripts/data/category-intros.json (keyed by slug).
 *   npx tsx --env-file=../../.env scripts/category-intros.ts           → dry run: shows what would change
 *   npx tsx --env-file=../../.env scripts/category-intros.ts --apply   → save (later edits: Admin → Categories)
 * Only fills categories whose intro is still empty, unless --force.
 */
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../src/config/db";
import { categories } from "../src/models";
import { logAdminAction } from "../src/utils/audit";

type Entry = { description: string; intro: string };

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");
  const data = JSON.parse(readFileSync(new URL("./data/category-intros.json", import.meta.url), "utf8")) as Record<string, Entry>;
  for (const [slug, entry] of Object.entries(data)) {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    if (!cat) { console.log(`- ${slug}: no such category, skipped`); continue; }
    if (cat.intro && !force) { console.log(`- ${slug}: already has an intro, skipped`); continue; }
    const words = entry.intro.split(/\s+/).length;
    console.log(`${apply ? "✓" : "•"} ${slug}: description ${entry.description.length} chars, intro ${words} words`);
    if (!apply) continue;
    await db.update(categories).set({ description: entry.description, intro: entry.intro }).where(eq(categories.id, cat.id));
    await logAdminAction({
      adminId: null,
      action: "category.update",
      targetType: "category",
      targetId: cat.id,
      details: { changes: { description: { from: cat.description, to: entry.description }, intro: { from: cat.intro ? "(text)" : null, to: `(${words} words)` } } },
    });
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
