/**
 * Run a .sql migration file against DATABASE_URL.
 *   pnpm tsx --env-file=../../.env scripts/run-sql.mts scripts/migrations/<file>.sql
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

const file = process.argv[2];
if (!file) throw new Error("Usage: run-sql.mts <file.sql>");
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
try {
  await sql.unsafe(readFileSync(file, "utf8"));
  console.log(`Applied ${file}`);
} finally {
  await sql.end();
}
