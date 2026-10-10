// `pnpm --filter @aura/api test:cleanup` — removes EVERY leftover test user + their data.
import { cleanupTestData } from "./cleanup";
import { sql } from "./db";
import { ALL_TEST_EMAIL_PATTERN } from "./run";

cleanupTestData(ALL_TEST_EMAIL_PATTERN)
  .then(async (result) => {
    console.log("[test:cleanup] removed:", result);
    const [left] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM users WHERE email LIKE ${ALL_TEST_EMAIL_PATTERN}`;
    console.log(`[test:cleanup] test users remaining: ${left?.n}`);
  })
  .catch((err) => {
    console.error("[test:cleanup] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
