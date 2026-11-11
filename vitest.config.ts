import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Two projects (ARCHITECTURE.md §25):
 * - `node`  — pure logic: helpers, schemas, error mapping, services, and the
 *             database-backed integration suites.
 * - `jsdom` — React components rendered with Testing Library.
 *
 * `fileParallelism: false` on the node project is deliberate: the database
 * suites share one dedicated database and truncate it between tests, so two
 * files running at once would delete each other's rows. Unit files are cheap,
 * and correctness beats a couple of seconds.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["server/services/**", "lib/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    projects: [
      {
        resolve: {
          alias: {
            "@": projectRoot,
          },
        },
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/unit/**/*.test.ts",
            "tests/db/**/*.test.ts",
            "tests/integration/**/*.test.ts",
            "tests/performance/**/*.test.ts",
          ],
          setupFiles: ["tests/setup.ts"],
          fileParallelism: false,
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": projectRoot,
          },
        },
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["tests/components/**/*.test.tsx"],
          setupFiles: ["tests/setup.ts"],
          testTimeout: 15000,
        },
      },
    ],
  },
});
