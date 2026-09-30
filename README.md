# Psychological Consultation Booking Platform

A production-grade, highly reliable psychological consultation booking platform built with Next.js 16 (App Router, Turbopack) and TypeScript in strict mode.

---

## Architectural Documentation

Comprehensive system blueprints, rationale, and execution roadmaps are maintained directly in the repository root:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Architectural source of truth (system design, security, RBAC, booking invariants, timezone handling).
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** — 24-step dependency-ordered implementation roadmap.
- **[ADR.md](./ADR.md)** — 20 Architecture Decision Records explaining context and trade-offs.

---

## Prerequisites

- **Node.js:** v20.9.0 or higher
- **pnpm:** v10.28.2+
- **PostgreSQL:** 16+ with the `btree_gist` extension (required for double-booking exclusion constraints)

---

## Environment Configuration

Configuration values are strictly validated at import time via `config/env.ts`.

Copy `.env.example` to `.env.local` to start development:

```bash
cp .env.example .env.local
```

Refer to `.env.example` and `ARCHITECTURE.md §27` for detailed documentation of all variables.

---

## Available Scripts

```bash
# Start development server
pnpm dev

# Check code formatting with Prettier
pnpm format:check

# Format codebase with Prettier
pnpm format

# Run ESLint
pnpm lint

# Run TypeScript compilation and Next route typegen
pnpm typecheck

# Run tests (placeholder in Step 1, Vitest runner from Step 2 onward)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Create and apply a migration from schema changes
pnpm db:migrate

# Apply committed migrations (CI, production)
pnpm db:deploy

# Drop, re-apply every migration, and reseed
pnpm db:reset

# Upsert the deterministic development dataset
pnpm db:seed

# Browse the data
pnpm db:studio

# Create optimized production build
pnpm build

# Start production server
pnpm start
```

---

## Database

PostgreSQL 16+ with the `btree_gist` extension: double-booking prevention is enforced by exclusion constraints over `tstzrange`, not by application code.

### Local instance

```bash
docker compose up -d     # PostgreSQL 16 on :5432
docker compose down      # stop, keeping data
docker compose down -v   # stop and delete data
```

The container creates two databases on first start: `consulting` (development, seeded by `pnpm db:seed`) and `consulting_test` (the Vitest database suites). A native PostgreSQL installation works equally well — create both databases by hand and point the URLs in `.env.local` at them.

### Connection strings, roles, and privileges

| Variable            | Used by                                               | Privileges                                                                                                       |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | the application at runtime (pooled)                   | **DML only** — `SELECT`/`INSERT`/`UPDATE`/`DELETE` and the sequences they need. No `CREATE`, `ALTER`, or `DROP`. |
| `DIRECT_URL`        | `prisma migrate`, `prisma db seed` (direct, unpooled) | Owns the schema: may run DDL and create extensions.                                                              |
| `TEST_DATABASE_URL` | the Vitest database suites in `tests/db/`             | A dedicated database the suites truncate between tests.                                                          |

The split is deliberate. A compromised application instance holds credentials that cannot drop a table, alter a constraint, or disable the double-booking guarantee, because the role it authenticates as has no DDL rights. Only the migration path — run from CI or an operator's shell, never from the running app — connects as the schema owner. `prisma.config.ts` therefore prefers `DIRECT_URL` and falls back to `DATABASE_URL` only in single-connection environments such as local development (ARCHITECTURE.md §8.1, §26). Production applies the two-role split in Step 23.

Without `TEST_DATABASE_URL` the database suites fall back to `DATABASE_URL` and truncate the development rows they exercise; set the variable (as `.env.example` does) to keep development data intact.

### Migrations

Committed migrations are the only source of schema truth, so `prisma migrate deploy` reproduces an identical database everywhere, extensions included.

```bash
pnpm db:migrate      # create and apply a migration from schema.prisma changes
pnpm exec prisma migrate dev --name <name> --create-only   # generate SQL, then review it by hand
pnpm db:deploy       # apply committed migrations (CI and production)
pnpm db:reset        # drop, re-apply every migration, and reseed
pnpm db:seed         # upsert the deterministic development dataset
pnpm db:studio       # browse the data
```

`prisma/schema.prisma` cannot express four things, all of which live as reviewed SQL in `prisma/migrations/<ts>_constraints/migration.sql`: the two `EXCLUDE` constraints (`appointment_consultant_no_overlap`, `appointment_client_no_overlap`), the `CHECK` constraints (time ordering, rule minutes, rating range, positive price), the partial unread-notification index, and the GIN full-text search index. `tests/db/constraints.test.ts` asserts that each one exists and bites, so a migration that drops one fails CI.

The seed never runs against data by accident: it refuses unless the database holds no users, or `NODE_ENV` is not `production` **and** `--force` is passed.

---

## Core Technical Conventions

- **Next.js 16 APIs:** Request APIs (`cookies()`, `headers()`, `params`, `searchParams`) are asynchronous and must be awaited. `proxy.ts` replaces `middleware.ts`.
- **Environment Access:** Direct usage of `process.env` is restricted. Always import `{ env }` from `@/config/env`.
- **Database & Concurrency:** Overlap prevention is enforced at the database level using PostgreSQL exclusion constraints over `tstzrange` (`btree_gist`).
- **Authorization & Scoping:** Ownership filtering occurs directly inside query `where` clauses; unmatched or unowned private records yield 404 rather than 403.
