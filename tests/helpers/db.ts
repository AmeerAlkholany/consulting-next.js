import { env } from "@/config/env";
import {
  assertDatabaseReachable,
  createPrismaClient,
  formatConnectionTarget,
} from "@/db/create-client";

/**
 * Database test harness (IMPLEMENTATION.md Step 3, ARCHITECTURE.md §25).
 *
 * Database suites truncate every row they create, so they never point at the
 * development database when a dedicated one exists: `TEST_DATABASE_URL` wins,
 * which `docker compose` provisions as `consulting_test` and CI creates beside
 * `consulting`. Without it the suites fall back to `DATABASE_URL` and wipe the
 * development rows they exercise — re-run `pnpm db:seed` afterwards.
 *
 * The client is built by `db/create-client.ts` — the same adapter and pool
 * settings as the application — rather than `db/client.ts`, which is marked
 * `server-only` and would be a lie inside a plain Node process.
 */
const connectionString = env.TEST_DATABASE_URL ?? env.DATABASE_URL;

function requireConnectionString(): string {
  if (!connectionString) {
    throw new Error(
      "Neither TEST_DATABASE_URL nor DATABASE_URL is set. Copy .env.example to .env.local and point it at your PostgreSQL instance.",
    );
  }
  return connectionString;
}

if (!env.TEST_DATABASE_URL) {
  console.warn(
    "[db] TEST_DATABASE_URL is not set: the database suites will truncate DATABASE_URL. " +
      'Set TEST_DATABASE_URL to a dedicated database (README, "Database").',
  );
}

export const prisma = createPrismaClient({ connectionString: requireConnectionString() });

/**
 * Turns an unreachable or unmigrated database into one startup error that names
 * the host and database — never the password — instead of letting every
 * assertion fail on a missing table.
 */
export async function assertDatabaseReady(): Promise<void> {
  const url = requireConnectionString();
  await assertDatabaseReachable(prisma, url);

  const [relation] = await prisma.$queryRaw<Array<{ table: string | null }>>`
    SELECT to_regclass('"Appointment"')::text AS "table"
  `;

  if (!relation?.table) {
    throw new Error(
      `The database at ${formatConnectionTarget(url)} has no migrations applied. Run \`pnpm db:deploy\` first.`,
    );
  }
}

/**
 * Per-suite isolation. Static taxonomy (`Specialization`, `Language`) is left
 * in place on purpose: it is referenced with RESTRICT and the constraint suite
 * asserts that, so deleting it would hide the behaviour under test.
 */
export async function cleanDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Notification",
      "EmailOutbox",
      "AuditLog",
      "AppointmentNote",
      "Review",
      "Appointment",
      "AvailabilityException",
      "AvailabilityRule",
      "ConsultantSpecialization",
      "ConsultantLanguage",
      "ClientLanguage",
      "Qualification",
      "ConsultantProfile",
      "ClientProfile",
      "VerificationToken",
      "Session",
      "User"
    CASCADE;
  `);
}

/** Releases the pool so Vitest can exit without a lingering handle. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
