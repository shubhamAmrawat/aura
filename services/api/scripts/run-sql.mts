/**
 * Run one .sql file against DATABASE_URL (prefer `pnpm db:migrate`, which also records it).
 *   pnpm tsx --env-file=../../.env scripts/run-sql.mts scripts/migrations/<file>.sql
 * Production is refused unless --prod is passed.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { describe, isProduction } from "./lib/db-target.mts";

const file = process.argv[2];
if (!file || file.startsWith("--")) throw new Error("Usage: run-sql.mts <file.sql> [--prod]");
const url = process.env.DATABASE_URL!;
if (isProduction(url) && !process.argv.includes("--prod")) {
  console.error("DATABASE_URL is the PRODUCTION database. Pass --prod if you really mean it.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1 });
try {
  console.log(`Target: ${describe(url)}`);
  await sql.unsafe(readFileSync(file, "utf8"));
  console.log(`Applied ${file}`);
} finally {
  await sql.end();
}
