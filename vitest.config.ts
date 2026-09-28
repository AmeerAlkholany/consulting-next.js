import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Two projects (ARCHITECTURE.md §25):
 * - `node`  — pure logic: helpers, schemas, error mapping, services.
 * - `jsdom` — React components rendered with Testing Library.
 */
export default defineConfig({
  test: {
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
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["tests/setup.ts"],
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
        },
      },
    ],
  },
});
