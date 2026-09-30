import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Loads `.env*` files into `process.env` for entry points that run OUTSIDE the
 * Next.js runtime.
 *
 * Next.js loads `.env*` files automatically for `next dev`, `next build`, and
 * `next start` (see ARCHITECTURE.md §27). The Prisma CLI, the seed script, and
 * the Vitest database suites run in plain Node instead, where nothing loads
 * them: this module closes that gap with the same precedence rules Next.js
 * uses, so a value resolved here matches the value the application would see.
 *
 * MUST NOT be imported from `app/` or `components/`. The application runtime
 * (server or client) already has its environment loaded; reading files here
 * would at best be redundant and at worst break the client bundle.
 *
 * Precedence, highest first — identical to Next.js:
 *   1. variables already present in the real environment (never overwritten)
 *   2. `.env.${NODE_ENV}.local`
 *   3. `.env.local`   (skipped when NODE_ENV is "test")
 *   4. `.env.${NODE_ENV}`
 *   5. `.env`
 *
 * `process.loadEnvFile` is a Node built-in (Node >= 20.12) that parses with
 * dotenv semantics and leaves existing variables untouched, which is exactly
 * rule 1. Files are therefore loaded in precedence order: the first file that
 * defines a name wins.
 */
export function loadEnvFiles(options?: { cwd?: string; nodeEnv?: string }): string[] {
  const cwd = options?.cwd ?? process.cwd();
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? "development";

  const candidates = [
    `.env.${nodeEnv}.local`,
    nodeEnv === "test" ? undefined : ".env.local",
    `.env.${nodeEnv}`,
    ".env",
  ].filter((file): file is string => typeof file === "string");

  const loaded: string[] = [];

  for (const file of candidates) {
    const absolutePath = path.join(cwd, file);
    if (!existsSync(absolutePath)) {
      continue;
    }
    process.loadEnvFile(absolutePath);
    loaded.push(file);
  }

  return loaded;
}

// Auto-run if imported directly for side-effects
loadEnvFiles();
