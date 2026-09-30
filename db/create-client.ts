import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Construction of Prisma clients, shared by every process that talks to the
 * database: the application (`db/client.ts`), the seed (`db/seed.ts`), and the
 * database test suites (`tests/helpers/db.ts`).
 *
 * The factory lives outside `db/client.ts` because that module is marked
 * `server-only`, which throws when imported in a plain Node process. Keeping
 * the construction here means the seed and the tests use the exact same pool
 * settings and adapter as the application, without duplicating them.
 *
 * Prisma 7 is Rust-free: a driver adapter is required, and `pg`'s pool — not
 * Prisma — owns connection lifecycle (ARCHITECTURE.md §8.1, §28).
 */

export type PrismaQueryEvent = {
  query: string;
  params: string;
  durationMs: number;
};

export type PrismaLogEvent = {
  message: string;
  target?: string;
};

export interface CreatePrismaClientOptions {
  /** Connection string. Callers pass `env.DATABASE_URL` or a test database URL. */
  connectionString: string;
  /** Called for every SQL statement. Enables Prisma's per-query diagnostics. */
  onQuery?: (event: PrismaQueryEvent) => void;
  /** Called for Prisma warnings (deprecations, connection pool notices). */
  onWarn?: (event: PrismaLogEvent) => void;
  /** Called for errors Prisma logs. Thrown errors are unaffected. */
  onError?: (event: PrismaLogEvent) => void;
}

/**
 * Pool sizing for a single application instance. The database, not the pool,
 * is the scarce resource: 10 connections per instance keeps a handful of
 * instances well inside a managed Postgres connection limit (§28).
 */
const POOL = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
} as const;

export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: options.connectionString,
    max: POOL.max,
    idleTimeoutMillis: POOL.idleTimeoutMillis,
    connectionTimeoutMillis: POOL.connectionTimeoutMillis,
  });

  // `emit: "event"` routes diagnostics to listeners instead of Prisma's own
  // stdout writer, which is what lets them go through `server/logger.ts`.
  const client = new PrismaClient({
    adapter,
    log: [
      { level: "query", emit: "event" },
      { level: "warn", emit: "event" },
      { level: "error", emit: "event" },
    ],
  });

  client.$on("query", (event) => {
    options.onQuery?.({
      query: event.query,
      params: event.params,
      durationMs: event.duration,
    });
  });
  client.$on("warn", (event) => {
    options.onWarn?.({ message: event.message, target: event.target });
  });
  client.$on("error", (event) => {
    options.onError?.({ message: event.message, target: event.target });
  });

  return client as PrismaClient;
}

/**
 * `host:port/database`, safe to print. Connection strings carry the password,
 * so they are never logged, thrown, or included in an error message.
 */
export function formatConnectionTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const database = url.pathname.replace(/^\//, "") || "(no database)";
    return `${url.hostname}:${url.port || "5432"}/${database}`;
  } catch {
    return "(unparseable connection string)";
  }
}

/**
 * Fails fast, naming the host and database but never the password, when the
 * database cannot be reached. The application connects lazily on first query,
 * so this is called by the long-running entry points — the seed and the test
 * harness — to turn a connection failure into one clear startup error
 * (ARCHITECTURE.md §8, error handling).
 */
export async function assertDatabaseReachable(
  client: PrismaClient,
  connectionString: string,
): Promise<void> {
  try {
    await client.$queryRaw`SELECT 1`;
  } catch (error) {
    const target = formatConnectionTarget(connectionString);
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Cannot reach the database at ${target}: ${reason}`, { cause: error });
  }
}
