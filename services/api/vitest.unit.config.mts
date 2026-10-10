import { defineConfig } from "vitest/config";

// Fast, offline unit tests (no server, no DB).
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/setup.ts"],
  },
});
