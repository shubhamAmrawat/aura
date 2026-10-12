/**
 * AI category pass: writes one row per wallpaper into category_suggestions (changes nothing users see).
 * Resumable — skips wallpapers that already have a suggestion. Time-boxed per run.
 *
 *   node --env-file=../../.env --import tsx scripts/ai-categorize.mts [--limit=N] [--seconds=140] [--concurrency=8]
 *
 * Choices = all categories except "uncategorized" and the ones being merged away (MERGED below);
 * a wallpaper currently in a merged category is described as being in its merge target.
 */
import { sql as dsql } from "drizzle-orm";
import type { CategoryOption } from "../src/services/categoryAi.service";

// The API is CommonJS: load its modules through the default export when tsx wraps them.
const load = async <T,>(p: string): Promise<T> => { const m: any = await import(p); return (m.default ?? m) as T; };
const { db } = await load<typeof import("../src/config/db")>("../src/config/db");
const { classifyWallpaperCategory, CATEGORY_AI_MODEL } = await load<typeof import("../src/services/categoryAi.service")>("../src/services/categoryAi.service");

const MERGED: Record<string, string> = { urban: "city", landscape: "nature" };
const EXCLUDED = new Set(["uncategorized", ...Object.keys(MERGED)]);
const arg = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d);
const LIMIT = arg("limit", 100000), SECONDS = arg("seconds", 140), CONC = arg("concurrency", 8);

const cats = (await db.execute(dsql`SELECT id, slug, name FROM categories ORDER BY sort_order`)) as unknown as { id: string; slug: string; name: string }[];
const options: CategoryOption[] = cats.filter((c) => !EXCLUDED.has(c.slug));
const bySlug = new Map(cats.map((c) => [c.slug, c]));
const byId = new Map(cats.map((c) => [c.id, c]));
/** The category a wallpaper will be in after the merges (null for uncategorized). */
const effective = (catId: string | null) => {
  const c = catId ? byId.get(catId) : undefined;
  if (!c || c.slug === "uncategorized") return null;
  return MERGED[c.slug] ? bySlug.get(MERGED[c.slug]!)! : c;
};

const todo = (await db.execute(dsql`
  SELECT w.id, w.title, w.description, w.tags, w.file_url, w.category_id
  FROM wallpapers w LEFT JOIN category_suggestions s ON s.wallpaper_id = w.id
  WHERE s.wallpaper_id IS NULL ORDER BY w.created_at LIMIT ${LIMIT}`)) as unknown as {
  id: string; title: string; description: string | null; tags: string[]; file_url: string; category_id: string | null;
}[];

const started = Date.now();
let done = 0, failed = 0, textOnly = 0, tokIn = 0, tokOut = 0, next = 0;
const worker = async () => {
  while (next < todo.length && (Date.now() - started) / 1000 < SECONDS) {
    const w = todo[next++]!;
    const cur = effective(w.category_id);
    try {
      const v = await classifyWallpaperCategory(
        { imageUrl: w.file_url, title: w.title, description: w.description, tags: w.tags, currentCategoryName: cur?.name ?? null },
        options
      );
      tokIn += v.tokens.input; tokOut += v.tokens.output;
      if (!v.usedImage) textOnly++;
      await db.execute(dsql`
        INSERT INTO category_suggestions (wallpaper_id, current_category_id, suggested_category_id, alternative_category_id,
          confidence, current_fits, new_category_idea, reason, model)
        VALUES (${w.id}, ${cur?.id ?? null}, ${v.categoryId}, ${v.alternativeId}, ${v.confidence}, ${v.currentFits},
          ${v.newCategoryIdea}, ${v.reason}, ${CATEGORY_AI_MODEL + (v.usedImage ? "" : ":text")})
        ON CONFLICT (wallpaper_id) DO NOTHING`);
      done++;
    } catch (e) {
      failed++;
      console.error(`[fail] ${w.id} ${w.title}: ${(e as Error).message.slice(0, 120)}`);
    }
  }
};
await Promise.all(Array.from({ length: CONC }, worker));
// gpt-4o-mini: $0.15 / 1M input, $0.60 / 1M output
const cost = (tokIn * 0.15 + tokOut * 0.6) / 1e6;
const [{ left }] = (await db.execute(dsql`SELECT count(*)::int AS left FROM wallpapers w LEFT JOIN category_suggestions s ON s.wallpaper_id = w.id WHERE s.wallpaper_id IS NULL`)) as unknown as { left: number }[];
console.log(JSON.stringify({ done, failed, textOnly, seconds: Math.round((Date.now() - started) / 1000), tokIn, tokOut, costUsd: +cost.toFixed(4), remaining: left }));
process.exit(0);
