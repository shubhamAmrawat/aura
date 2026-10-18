/**
 * Fill the DEV database with starter data copied (read-only) from production:
 * all categories, category redirects, site settings, and a sample of approved
 * wallpapers (the featured ones + the top N per category), with their extra categories.
 *
 * Users, likes, collections, downloads, OTPs and admin history are NOT copied.
 * Copied wallpapers have no uploader and keep their cdn.aurora-walls.com image URLs
 * (read-only; the dev R2 token can't touch the production bucket).
 *
 *   cd services/api
 *   pnpm tsx --env-file=../../.env scripts/dev-seed.mts            # 15 per category
 *   pnpm tsx --env-file=../../.env scripts/dev-seed.mts --per-category 30
 *
 * Reads production from SOURCE_DATABASE_URL or .env.production; writes DATABASE_URL (dev).
 * Safe to re-run: rows that already exist are skipped.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { PROD_PROJECT_REF, describe, isProduction } from "./lib/db-target.mts";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const PER_CATEGORY = Number(arg("--per-category") ?? 15);

// Production is only ever read. Its URL comes from SOURCE_DATABASE_URL, or else from the
// DATABASE_URL line in the repo-root .env.production (kept out of git and out of .env).
function prodUrlFromFile(): string | undefined {
  try {
    const text = readFileSync(join(import.meta.dirname, "../../../.env.production"), "utf8");
    const line = text.split(/\r?\n/).find((l) => /^DATABASE_URL\s*=/.test(l));
    return line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}
const sourceUrl = process.env.SOURCE_DATABASE_URL ?? prodUrlFromFile();
const targetUrl = process.env.DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error("Set SOURCE_DATABASE_URL (production) and DATABASE_URL (dev).");
if (isProduction(targetUrl)) {
  throw new Error(`DATABASE_URL points at production (${PROD_PROJECT_REF}). Seeding only ever writes to a dev database.`);
}
if (!isProduction(sourceUrl)) console.warn("Note: SOURCE_DATABASE_URL is not the production project.");

// Keep timestamps as the raw text Postgres sends, so the machine's time zone can't shift them.
const rawTimestamps = { ts: { to: 1114, from: [1114], serialize: (x: unknown) => x, parse: (x: string) => x } };
const src = postgres(sourceUrl, { prepare: false, max: 1, types: rawTimestamps });
const dst = postgres(targetUrl, { prepare: false, max: 1, types: rawTimestamps });

async function copy(tx: postgres.TransactionSql, table: string, rows: Record<string, unknown>[], conflict: string) {
  if (!rows.length) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const res = await tx`insert into ${tx(table)} ${tx(chunk)} on conflict ${tx.unsafe(conflict)} do nothing`;
    inserted += res.count;
  }
  return inserted;
}

try {
  console.log(`Reading from ${describe(sourceUrl)}\nWriting to   ${describe(targetUrl)}\n`);

  const categories = await src`select * from categories`;
  const redirects = await src`select * from category_redirects`;
  const settings = (await src`select * from site_settings`).map((r) => ({ ...r, updated_by: null }));
  const wallpapers = (
    await src`
      with ranked as (
        select id, row_number() over (partition by category_id order by trending_score desc, created_at desc) as rn
        from wallpapers where status = 'approved'
      )
      select w.* from wallpapers w
      where w.status = 'approved'
        and (w.is_featured or w.id in (select id from ranked where rn <= ${PER_CATEGORY}))`
  ).map((w) => ({ ...w, uploader_id: null, reviewed_by: null }));
  const ids = wallpapers.map((w) => w.id as string);
  const extraCats = ids.length ? await src`select * from wallpaper_categories where wallpaper_id in ${src(ids)}` : [];

  // All-or-nothing: queries must go through `tx` (the pool has one connection).
  await dst.begin(async (tx) => {
    console.log(`categories           ${await copy(tx, "categories", categories, "(id)")} new / ${categories.length}`);
    console.log(`category_redirects   ${await copy(tx, "category_redirects", redirects, "(old_slug)")} new / ${redirects.length}`);
    console.log(`site_settings        ${await copy(tx, "site_settings", settings, "(key)")} new / ${settings.length}`);
    console.log(`wallpapers           ${await copy(tx, "wallpapers", wallpapers, "(id)")} new / ${wallpapers.length}`);
    console.log(`wallpaper_categories ${await copy(tx, "wallpaper_categories", extraCats, "(wallpaper_id, category_id)")} new / ${extraCats.length}`);
  });
  console.log("\nDone. Create your dev admin with: pnpm tsx --env-file=../../.env scripts/create-admin.mts you@example.com");
} finally {
  await src.end();
  await dst.end();
}
