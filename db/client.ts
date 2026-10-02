import "server-only";

import { env } from "@/config/env";
import { logger } from "@/server/logger";
import { createPrismaClient } from "./create-client";

/**
 * The application's database entry point (ARCHITECTURE.md §8, §28).
 *
 * - `import "server-only"` makes a client-component import a build error, so
 *   the ORM can never be pulled into a browser bundle.
 * - The instance is cached on `globalThis` in every environment except
 *   production, so hot reload during development reuses one connection pool
 *   instead of leaking a pool per reload.
 * - Query, warning, and error diagnostics are routed to `server/logger.ts`
 *   rather than Prisma's own stdout writer.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

function resolveConnectionString(): string {
  // The integration suites exercise the real service layer, which imports this
  // module. In `NODE_ENV=test` the dedicated test database therefore wins, under
  // the same rule `tests/helpers/db.ts` applies, so a suite can never truncate
  // or pollute development data (ARCHITECTURE.md §25, §27).
  const connectionString =
    env.NODE_ENV === "test" ? (env.TEST_DATABASE_URL ?? env.DATABASE_URL) : env.DATABASE_URL;

  if (!connectionString) {
    // Names the variable, never a value: a connection string carries the
    // password (ARCHITECTURE.md §8, error handling).
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your PostgreSQL instance.",
    );
  }

  return connectionString;
}

function createClient(): ReturnType<typeof createPrismaClient> {
  return createPrismaClient({
    connectionString: resolveConnectionString(),
    onQuery: (event) => {
      logger.debug({ durationMs: event.durationMs, params: event.params }, event.query);
    },
    onWarn: (event) => {
      logger.warn({ target: event.target }, event.message);
    },
    onError: (event) => {
      logger.error({ target: event.target }, event.message);
    },
  });
}

export const db: ReturnType<typeof createPrismaClient> = globalForPrisma.prisma ?? createClient();
export const prisma = db;

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Re-exported so application code imports the ORM through one module, and the
// lint boundary in eslint.config.mjs can keep components away from all of it.
export type { PrismaClient } from "./generated/prisma/client";
export * from "./generated/prisma/enums";
