/**
 * Make the small category thumbnails used by the navbar Explore menu.
 *
 *   pnpm tsx --env-file=../../.env scripts/category-thumbs.ts            # dry run: show what would change
 *   pnpm tsx --env-file=../../.env scripts/category-thumbs.ts --apply    # make missing / out-of-date ones
 *   pnpm tsx --env-file=../../.env scripts/category-thumbs.ts --apply --force   # remake all
 */
import { asc } from "drizzle-orm";
import { db } from "../src/config/db";
import { categories } from "../src/models";
import { refreshCategoryThumb, thumbSourceFor } from "../src/services/categoryThumb.service";

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

async function main() {
  const rows = await db
    .select({ id: categories.id, name: categories.name, thumb: categories.coverThumbUrl, source: categories.coverThumbSource })
    .from(categories)
    .orderBy(asc(categories.sortOrder));

  let todo = 0;
  for (const c of rows) {
    const source = await thumbSourceFor(c.id);
    const state = !source ? (c.thumb ? "clear (no wallpapers)" : "none (no wallpapers)") : force || !c.thumb || c.source !== source ? "make" : "ok";
    if (state.startsWith("make") || state.startsWith("clear")) todo++;
    if (!apply) {
      console.log(`${state.padEnd(22)} ${c.name}`);
      continue;
    }
    try {
      const result = await refreshCategoryThumb(c.id, { force });
      console.log(`${result.padEnd(10)} ${c.name}`);
    } catch (e) {
      console.error(`failed     ${c.name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(apply ? "Done." : `\n${todo} to change. Run with --apply to make them.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
