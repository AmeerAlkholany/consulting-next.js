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

# Create optimized production build
pnpm build

# Start production server
pnpm start
```

---

## Core Technical Conventions

- **Next.js 16 APIs:** Request APIs (`cookies()`, `headers()`, `params`, `searchParams`) are asynchronous and must be awaited. `proxy.ts` replaces `middleware.ts`.
- **Environment Access:** Direct usage of `process.env` is restricted. Always import `{ env }` from `@/config/env`.
- **Database & Concurrency:** Overlap prevention is enforced at the database level using PostgreSQL exclusion constraints over `tstzrange` (`btree_gist`).
- **Authorization & Scoping:** Ownership filtering occurs directly inside query `where` clauses; unmatched or unowned private records yield 404 rather than 403.
