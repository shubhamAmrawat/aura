import { defineConfig } from "vitest/config";

// In-process tests: the Express app runs inside vitest (supertest) against the real DB,
// with selected integrations mocked (e.g. Google token verification).
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
