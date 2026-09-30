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

function requireDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    // Names the variable, never a value: a connection string carries the
    // password (ARCHITECTURE.md §8, error handling).
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your PostgreSQL instance.",
    );
  }
  return env.DATABASE_URL;
}

function createClient(): ReturnType<typeof createPrismaClient> {
  return createPrismaClient({
    connectionString: requireDatabaseUrl(),
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
