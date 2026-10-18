/**
 * Apply pending SQL migrations (scripts/migrations/*.sql, in name order) and record each
 * one in the `schema_migrations` table, so every database knows what it already has.
 *
 *   pnpm db:migrate              # dev database (.env)  — status + apply what's pending
 *   pnpm db:migrate --status     # only show what's applied / pending
 *   pnpm db:migrate:prod         # production (.env.production) — asks you to type "production"
 *
 * One-time, for a database that already has every existing migration (made from the
 * baseline schema, or production itself): `--baseline` marks all files as applied
 * without running them.
 *
 * Production is refused unless --prod is passed (the npm script does that), and --prod is
 * refused for anything that isn't production, so the two can't be mixed up.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline/promises";
import postgres from "postgres";
import { describe, isProduction } from "./lib/db-target.mts";

const DIR = join(import.meta.dirname, "migrations");
const flag = (f: string) => process.argv.includes(f);
const STATUS = flag("--status");
const BASELINE = flag("--baseline");
const PROD = flag("--prod");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
if (isProduction(url) && !PROD) {
  console.error("DATABASE_URL is the PRODUCTION database. Use `pnpm db:migrate:prod` (it passes --prod) if you really mean it.");
  process.exit(1);
}
if (!isProduction(url) && PROD) {
  console.error("--prod was passed but DATABASE_URL is not production. Check your env file.");
  process.exit(1);
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) if (!/^[\w.-]+\.sql$/.test(f)) throw new Error(`Unexpected file name: ${f}`);

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
  const pending = files.filter((f) => !applied.has(f));

  console.log(`Target: ${describe(url)}`);
  console.log(`Applied: ${files.length - pending.length}/${files.length}${pending.length ? `\nPending:\n  ${pending.join("\n  ")}` : "  — up to date"}`);
  if (STATUS || !pending.length) process.exit(0);

  if (BASELINE) {
    for (const f of pending) await sql`insert into schema_migrations (name) values (${f}) on conflict do nothing`;
    console.log(`Marked ${pending.length} migration(s) as applied (not run).`);
    process.exit(0);
  }

  if (PROD) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`\nApply ${pending.length} migration(s) to PRODUCTION? Type "production" to continue: `);
    rl.close();
    if (answer.trim() !== "production") {
      console.log("Cancelled.");
      process.exit(1);
    }
  }

  for (const f of pending) {
    const body = readFileSync(join(DIR, f), "utf8");
    const record = `insert into schema_migrations (name) values ('${f}');`;
    // Files that manage their own BEGIN/COMMIT run as written; the rest get wrapped in one.
    const ownTx = /^\s*begin\s*;/im.test(body);
    try {
      if (ownTx) {
        await sql.unsafe(body);
        await sql.unsafe(record);
      } else {
        await sql.unsafe(`begin;\n${body}\n;\n${record}\ncommit;`);
      }
      console.log(`  ✓ ${f}`);
    } catch (err) {
      await sql.unsafe("rollback").catch(() => {});
      console.error(`  ✗ ${f}\n    ${err instanceof Error ? err.message : err}\nStopped. Nothing after this file was applied.`);
      process.exit(1);
    }
  }
  console.log("Done.");
} finally {
  await sql.end();
}
