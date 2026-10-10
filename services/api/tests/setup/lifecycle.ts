import { afterAll } from "vitest";
import { sql } from "./db";
import { cleanupTestData } from "./cleanup";
import { RUN_EMAIL_PATTERN } from "./run";

/** Call once at the top of every contract test file. */
export function useTestCleanup() {
  afterAll(async () => {
    try {
      await cleanupTestData(RUN_EMAIL_PATTERN);
    } finally {
      await sql.end();
    }
  });
}
