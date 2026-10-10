import { defineConfig } from "vitest/config";

// Black-box HTTP contract suite.
// Runs against whatever server is listening on API_BASE_URL (Hono now, Express later).
export default defineConfig({
  test: {
    include: ["tests/contract/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
    fileParallelism: false, // one file at a time: predictable DB state + rate limits
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
