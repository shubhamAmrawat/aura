/**
 * One-off: rewrite stored image URLs from the old r2.dev address to the CDN domain.
 *
 *   pnpm tsx --env-file=../../.env scripts/migrate-r2-urls.mts           # dry run (counts only)
 *   pnpm tsx --env-file=../../.env scripts/migrate-r2-urls.mts --apply   # backup CSV + update
 *
 * Run only after every service (Render API, Vercel web) uses the new R2_PUBLIC_URL.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const OLD = "https://pub-7a9b0809a66e45e99632a890f4327988.r2.dev/";
const NEW = "https://cdn.aurora-walls.com/";
const COLUMNS = [
  { table: "wallpapers", column: "file_url" },
  { table: "users", column: "avatar_url" },
  { table: "users", column: "cover_url" },
] as const;

const apply = process.argv.includes("--apply");
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

try {
  const backup: string[] = ["table,column,id,old_url"];
  for (const { table, column } of COLUMNS) {
    const rows = await sql.unsafe<{ id: string; url: string }[]>(
      `SELECT id::text AS id, "${column}" AS url FROM public."${table}" WHERE "${column}" LIKE $1`,
      [`${OLD}%`]
    );
    console.log(`${table}.${column}: ${rows.length} row(s) to update`);
    for (const r of rows) backup.push(`${table},${column},${r.id},${r.url}`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to update.");
  } else {
    const dir = resolve(import.meta.dirname, "../../../backups");
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `r2-urls-before-cdn-${Date.now()}.csv`);
    writeFileSync(file, backup.join("\n") + "\n");
    console.log(`\nBackup written: ${file}`);

    await sql.begin(async (tx) => {
      for (const { table, column } of COLUMNS) {
        const res = await tx.unsafe(
          `UPDATE public."${table}" SET "${column}" = $2 || substr("${column}", length($1) + 1) WHERE "${column}" LIKE $1 || '%'`,
          [OLD, NEW]
        );
        console.log(`updated ${table}.${column}: ${res.count}`);
      }
    });

    const [left] = await sql`
      SELECT (SELECT count(*) FROM wallpapers WHERE file_url LIKE ${OLD + "%"})::int
           + (SELECT count(*) FROM users WHERE avatar_url LIKE ${OLD + "%"} OR cover_url LIKE ${OLD + "%"})::int AS n`;
    console.log(`remaining old URLs: ${left!.n}`);
  }
} finally {
  await sql.end();
}
