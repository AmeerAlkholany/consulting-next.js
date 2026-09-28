# Architecture — Psychological Consultation Booking Platform

**Status:** Planning. No application code, schema, migration, or dependency described here has been implemented.
**Scope:** This document is the architectural source of truth. [IMPLEMENTATION.md](./IMPLEMENTATION.md) is the sequential build plan derived from it. [ADR.md](./ADR.md) records the reasoning behind the decisions it states.

---

## Table of contents

1. [System overview](#1-system-overview)
2. [Architectural principles](#2-architectural-principles)
3. [Technology stack](#3-technology-stack)
4. [Application architecture](#4-application-architecture)
5. [Folder structure](#5-folder-structure)
6. [Frontend architecture](#6-frontend-architecture)
7. [Backend architecture](#7-backend-architecture)
8. [Database architecture](#8-database-architecture)
9. [Authentication architecture](#9-authentication-architecture)
10. [Authorization / RBAC](#10-authorization--rbac)
11. [API architecture](#11-api-architecture)
12. [Server Actions / Route Handlers strategy](#12-server-actions--route-handlers-strategy)
13. [State management strategy](#13-state-management-strategy)
14. [Validation strategy](#14-validation-strategy)
15. [Error handling strategy](#15-error-handling-strategy)
16. [Security architecture](#16-security-architecture)
17. [Privacy considerations](#17-privacy-considerations)
18. [Booking architecture](#18-booking-architecture)
19. [Availability architecture](#19-availability-architecture)
20. [Notification architecture](#20-notification-architecture)
21. [Admin architecture](#21-admin-architecture)
22. [Consultant architecture](#22-consultant-architecture)
23. [Client architecture](#23-client-architecture)
24. [Logging strategy](#24-logging-strategy)
25. [Testing architecture](#25-testing-architecture)
26. [Deployment architecture](#26-deployment-architecture)
27. [Environment variables](#27-environment-variables)
28. [Scalability considerations](#28-scalability-considerations)
29. [Application routing](#29-application-routing)
30. [UI/UX architecture](#30-uiux-architecture)

---

## 0. Repository audit (what exists today)

Everything in this section was read from the repository, not assumed.

| Concern         | Finding                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Framework       | `next@16.3.5`, App Router, Turbopack default                                                                                  |
| React           | `react@19.2.8`, `react-dom@19.2.8`                                                                                            |
| Language        | `typescript@^5`, `strict: true`, `moduleResolution: "bundler"`, `target: "ES2017"`                                            |
| Path alias      | `@/*` → `./*` (repository root; **no `src/` directory**)                                                                      |
| Styling         | Tailwind CSS v4 via `@tailwindcss/postcss`; CSS-first config in `app/globals.css` (`@import "tailwindcss"` + `@theme inline`) |
| Fonts           | `next/font/google` — Geist + Geist Mono, exposed as `--font-geist-sans` / `--font-geist-mono`                                 |
| Lint            | ESLint 9 flat config (`eslint-config-next/core-web-vitals` + `/typescript`)                                                   |
| Package manager | pnpm 10.28.2, `pnpm-workspace.yaml` present (single package)                                                                  |
| Next config     | `typedRoutes: true` only                                                                                                      |
| Scripts         | `dev`, `build`, `start`, `lint`, `typecheck` (`next typegen && tsc --noEmit`)                                                 |
| Routes          | `app/layout.tsx`, `app/page.tsx` only — the `create-next-app` scaffold                                                        |
| Env config      | No `.env`, no `.env.example`. `.gitignore` ignores `.env*` but negates `!.env.example`                                        |
| Tests           | None. No test runner installed                                                                                                |
| Database        | None. No Prisma, no ORM, no `prisma/` directory                                                                               |
| Auth            | None                                                                                                                          |
| Git             | Branch `main`, 2 commits, working tree has modified `.gitignore`, `next.config.ts`, `package.json`                            |

**Existing conventions observed:** double quotes, semicolons, 2-space indent, named function components, `LayoutProps<"/">` route-helper types already in use in `app/layout.tsx`, explanatory comments above non-obvious config.

**Not yet installed** (each is introduced by the step that needs it, never up front): PostgreSQL client + Prisma, password hashing, Zod, React Hook Form, shadcn/ui primitives, date/timezone library, logger, test runners.

### Next.js 16 constraints that shape this design

Verified against `node_modules/next/dist/docs/`. This version differs materially from 13–15.

- **Request APIs are async-only.** `cookies()`, `headers()`, `draftMode()` return promises; `params` and `searchParams` are promises in pages, layouts, and Route Handlers. Since every authenticated page reads the session cookie, nearly every dashboard page is `async` and dynamically rendered. That is expected here, not a regression.
- **`proxy.ts` replaces `middleware.ts`.** The exported function is named `proxy` (or a default export). Runtime is Node.js and is **not** configurable. Next.js explicitly documents Proxy as a last resort and warns that Server Functions are POSTs to the route that uses them, so a matcher change can silently drop Proxy coverage. Proxy is therefore used only for coarse redirects, never as the authorization boundary.
- **Cache APIs changed.** Single-argument `revalidateTag(tag)` is deprecated; use `revalidateTag(tag, 'max')`. `updateTag(tag)` gives read-your-own-writes semantics and is **only** callable inside Server Actions. `refresh()` refreshes the client router from a Server Action.
- **`cacheComponents` (Partial Prerendering + `use cache`) is opt-in** and not enabled. It stays off for the initial build; see [ADR-012](./ADR.md#adr-012--caching-posture).
- **`forbidden()` / `unauthorized()` require `experimental.authInterrupts`.** Both are experimental; the plan does not depend on them ([ADR-011](./ADR.md#adr-011--authorization-failure-surfaces)).
- **Typed routes are on.** `PageProps<'/consultants/[slug]'>`, `LayoutProps`, `RouteContext<'/api/...'>` are globals generated by `next typegen`; they are absent on a clean checkout until `pnpm typecheck`, `next dev`, or `next build` runs.
- **Turbopack is the default bundler.** Adding a `webpack` config would break the build. Do not add one.
- **Parallel routes require an explicit `default.tsx` in every slot.**
- `next dev` writes to `.next/dev`, so `dev` and `build` can run concurrently.

---

## 1. System overview

A web platform that connects people seeking psychological support ("clients") with vetted psychological consultants, and lets them book time-boxed consultations.

**Actors**

| Actor               | Summary                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor (anonymous) | Browses approved consultants, reads public profiles and published reviews, sees available slot _counts/times_ but cannot book                                         |
| CLIENT              | Registered seeker. Manages own profile, discovers consultants, books/cancels/reschedules appointments, reviews completed appointments                                 |
| CONSULTANT          | Registered professional, requires admin approval before becoming publicly visible or bookable. Manages professional profile, availability, and their own appointments |
| ADMIN               | Platform operator. Verifies consultants, manages users and the specialization taxonomy, inspects appointments, reads the audit log                                    |

**Core capability slices**

1. Identity — registration, login, sessions, password reset, email verification.
2. Profiles — client profile, consultant professional profile, qualifications, languages, specializations.
3. Discovery — search, filter, sort, paginate approved consultants; public consultant profile.
4. Availability — recurring weekly rules plus date exceptions, resolved into bookable slots in real time.
5. Booking — create, cancel, reschedule, complete, no-show; overlap-free by construction.
6. Workspaces — client dashboard, consultant dashboard, admin console.
7. Platform services — notifications, reviews, audit logging, scheduled jobs.

**Out of scope for v1** (architecture must not block them): payments and payouts, video/telehealth sessions, external calendar sync, SMS/push, multi-language UI and RTL, waiting lists, consultant document verification workflow with file storage, analytics warehouse.

**Context diagram**

```text
                 ┌────────────────────────────────────────────┐
  Browser  ──────▶            Next.js 16 (Node.js)            │
   (RSC +        │  proxy.ts  →  App Router (RSC + Actions)    │
    minimal JS)  │              ├─ Server Components (reads)   │
                 │              ├─ Server Actions (writes)     │
                 │              └─ Route Handlers (few)        │
                 │                      │                      │
                 │            Data Access Layer (server-only)  │
                 │                      │                      │
                 │                Domain services              │
                 └──────────────────────┼──────────────────────┘
                                        │ Prisma
                                ┌───────▼────────┐
                                │  PostgreSQL     │
                                └───────┬────────┘
                                        │
            ┌───────────────────────────┼────────────────────────────┐
            │                           │                            │
   Scheduled jobs (cron →       Email provider (deferred,     Rate-limit store
   /api/cron/*, secret)          outbox-driven)               (memory dev / Redis prod)
```

---

## 2. Architectural principles

1. **Server-first.** Server Components are the default. `"use client"` is added only for genuine interactivity (form state, dialogs, slot picker, filters). Client Components receive data as props; they never fetch privileged data themselves.
2. **One way to reach data.** All reads and writes go through a `server-only` Data Access Layer and domain services. No Prisma import outside `server/` and `db/`. No `process.env` read outside `config/env.ts` and the DAL.
3. **Authorization lives next to the data.** Every Server Action, Route Handler, and DAL query re-derives the caller from the session and checks ownership. Proxy redirects are UX, not security.
4. **Validate at every boundary, invariants in one place.** Zod parses untrusted input (form data, `params`, `searchParams`, JSON bodies). Business invariants (can this be cancelled? is this slot real?) live in domain services, not in components.
5. **The database enforces what must never be violated.** Double booking, duplicate reviews, and orphaned rows are prevented by constraints, not only by application checks.
6. **Least data exposed.** Queries select explicit fields and return DTOs. Client identities never appear in public surfaces. Sensitive values never appear in URLs, logs, or error messages.
7. **Fail explicitly and opaquely.** Known domain outcomes return typed results with safe, human messages. Unexpected failures are logged server-side with a correlation ID and surface as a generic message.
8. **Boring where boring is fine.** No global state library, no GraphQL, no microservices, no event bus. Complexity is spent on booking correctness, timezone handling, and authorization — nowhere else.
9. **No placeholder implementations.** A step is done when it performs the real database operation and enforces the real rule.
10. **Accessibility and calm are functional requirements,** not polish. People arrive at this product under stress.

---

## 3. Technology stack

| Layer                  | Choice                                                                                               | Notes                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Framework              | Next.js 16.3.5 (App Router)                                                                          | Already installed                                                                 |
| UI runtime             | React 19.2.8                                                                                         | Server Components, Server Actions, `useActionState`, `useOptimistic`              |
| Language               | TypeScript 5 (`strict`)                                                                              | `any` is a defect except at unavoidable third-party seams                         |
| Styling                | Tailwind CSS v4 (CSS-first `@theme`)                                                                 | Already installed                                                                 |
| Component primitives   | shadcn/ui (Radix UI under the hood), vendored into `components/ui`                                   | Verify Tailwind v4 support at install time                                        |
| Database               | PostgreSQL 16+                                                                                       | Exclusion constraints and `btree_gist` are required (see §18)                     |
| ORM                    | Prisma                                                                                               | Schema, migrations, typed client                                                  |
| Auth                   | Custom credentials + database-backed sessions                                                        | [ADR-002](./ADR.md#adr-002--authentication-approach)                              |
| Password hashing       | Argon2id (`@node-rs/argon2`, or `argon2`)                                                            | Never bcrypt-by-default; parameters pinned in `config/security.ts`                |
| Validation             | Zod                                                                                                  | Single schema source shared by client forms and server boundaries                 |
| Forms                  | React Hook Form + `@hookform/resolvers`                                                              | Only for multi-field forms; trivial forms use plain `<form action={…}>`           |
| Dates/timezones        | `date-fns` v4 + `@date-fns/tz`                                                                       | Luxon is the documented fallback ([ADR-009](./ADR.md#adr-009--timezone-handling)) |
| Logging                | `pino` (structured JSON)                                                                             | With a redaction allowlist                                                        |
| Rate limiting          | Pluggable: in-memory (dev/single instance) → Redis (`@upstash/ratelimit` or `ioredis`) in production | [ADR-014](./ADR.md#adr-014--rate-limiting)                                        |
| Email                  | Deferred; outbox table written from day one, provider adapter added later (Resend/SES/SMTP)          |                                                                                   |
| Unit/integration tests | Vitest                                                                                               |                                                                                   |
| E2E tests              | Playwright                                                                                           |                                                                                   |
| Package manager        | pnpm 10.28.2                                                                                         |                                                                                   |

**Explicitly rejected:** tRPC (Server Actions cover it), Redux/Zustand/Jotai (no global client state), NextAuth/Auth.js for v1 ([ADR-002](./ADR.md#adr-002--authentication-approach)), a separate API service, an ORM-less SQL layer.

---

## 4. Application architecture

A **modular monolith** deployed as a single Next.js application, layered strictly:

```text
┌──────────────────────────────────────────────────────────────┐
│ Routing layer            app/**                              │
│  · Server Components render; they never contain domain rules │
│  · Server Actions are thin adapters: parse → call service    │
├──────────────────────────────────────────────────────────────┤
│ Feature layer            features/**                         │
│  · Feature-scoped UI, action wrappers, read models           │
├──────────────────────────────────────────────────────────────┤
│ Service layer            server/services/**   (server-only)  │
│  · Domain rules, transactions, invariants, state machines    │
│  · Emits notifications and audit entries                     │
├──────────────────────────────────────────────────────────────┤
│ Access layer             server/auth/**, server/dal/**       │
│  · Session resolution, guards, ownership checks, DTO mapping │
├──────────────────────────────────────────────────────────────┤
│ Persistence              db/client.ts + prisma/schema.prisma │
└──────────────────────────────────────────────────────────────┘
```

Rules that keep the layering honest:

- `server/**` and `db/**` start with `import 'server-only'`.
- Only `server/services/**` and `server/dal/**` may import the Prisma client.
- Server Actions contain no `prisma.` calls and no business branching — they validate, call one service function, map the result, and invalidate caches.
- Services never import from `app/**`, `components/**`, `features/**`, or `next/navigation`. They return values or throw typed domain errors; they do not redirect.
- `lib/**` is pure and framework-free: no Prisma, no `next/*`, no I/O. It is safe to import from both server and client code.

**Dependency direction:** `app → features → server/services → server/dal → db`. Never the reverse. `config/`, `schemas/`, `types/`, and `lib/` are leaves that anything may import.

---

## 5. Folder structure

Directories are created by the step that first needs them. No speculative empty folders.

```text
app/                       Routes only. Layouts, pages, loading/error/not-found, the few route handlers.
  (marketing)/             Public marketing + discovery shell
  (auth)/                  Login, register, password reset — centered minimal shell
  (client)/                Signed-in client shell (dashboard, appointments, profile)
  (consultant)/            Consultant workspace shell
  (admin)/                 Admin console shell
  api/                     Route Handlers (cron, health, small JSON reads) — see §11
components/
  ui/                      Design-system primitives (shadcn/ui vendored): Button, Input, Dialog, …
  layout/                  Shells, headers, sidebars, nav, footer
  feedback/                Skeletons, EmptyState, ErrorState, Toast host, ConfirmDialog
features/
  auth/                    Login/register forms, action wrappers
  consultants/             Discovery filters, consultant cards, public profile sections
  availability/            Availability editor, weekly grid, slot picker
  booking/                 Booking flow, cancel/reschedule dialogs
  appointments/            Appointment lists, detail panels, status badges
  reviews/                 Review form, rating display
  notifications/           Bell, list, mark-read
  admin/                   Verification queue, user table, taxonomy editor
server/                    server-only. The whole backend.
  auth/                    session.ts, password.ts, tokens.ts, dal.ts (verifySession/getCurrentUser)
  authz/                   policy.ts (permission matrix), guards.ts (requireUser/requireRole/requireOwner)
  services/                booking.ts, availability.ts, consultants.ts, clients.ts, reviews.ts,
                           notifications.ts, admin.ts, specializations.ts, audit.ts
  dal/                     Read models + DTO mappers, one file per aggregate
  errors.ts                AppError hierarchy + error codes
  logger.ts                pino instance + redaction
  rate-limit.ts            Pluggable limiter
db/
  client.ts                PrismaClient singleton (global in dev to survive HMR)
  seed.ts                  Deterministic seed: admin, specializations, demo consultants/clients
prisma/
  schema.prisma            Models, enums, indexes
  migrations/              Generated SQL, including hand-written constraint migrations
schemas/                   Zod schemas shared by forms, actions, and route handlers
types/                     Shared types: Result, DTOs, branded IDs, enum re-exports
config/                    env.ts (validated), site.ts, booking.ts (policy constants), roles.ts, nav.ts
hooks/                     Client-only React hooks
lib/                       Pure helpers: datetime.ts, money.ts, slug.ts, format.ts, cn.ts, pagination.ts
tests/
  integration/             Service + DB tests against a real Postgres
  e2e/                     Playwright specs
proxy.ts                   Coarse redirects only
```

**Responsibilities, stated once:**

- `app/` — URL shape, rendering, streaming boundaries, metadata. No rules.
- `components/` — presentational, domain-agnostic, reusable. Never imports from `features/` or `server/`.
- `features/` — the domain-aware UI. May import `components/`, `schemas/`, `types/`, `lib/`, and server actions.
- `server/` — every rule, every query, every authorization check.
- `db/` — connection and seed only.
- `schemas/` — the single definition of every input shape. Imported by both sides of the wire.
- `types/` — shared type vocabulary, including the `Result` union used by all actions.
- `config/` — constants and validated environment. The only place with policy numbers (cancellation window, page sizes, session TTL).
- `hooks/`, `lib/` — reusable, pure, testable.

**`services/` at the root is deliberately omitted** — it would duplicate `server/services/`. Two directories with the same meaning is the kind of complexity this plan avoids.

---

## 6. Frontend architecture

**Rendering model.** Server Components render by default and are dynamic (every authenticated page reads the session cookie). Public discovery pages are dynamic because they depend on `searchParams`, but their expensive read models are wrapped in cached functions with tags so repeated filters are cheap.

**Streaming.** Route shells (header, nav, page chrome) render immediately; session-dependent fragments (user menu, notification badge) and slow reads (consultant lists, slot grids) sit behind `<Suspense>` with skeletons. Per the Next.js docs, a top-level `await` on `cookies()` in a layout delays the whole segment, so the session read is pushed into a nested component wrapped in Suspense wherever the layout does not structurally depend on it.

**Client Component budget.** Client Components are limited to: forms with multi-field state, dialogs/sheets, the slot picker, the availability editor grid, discovery filter controls, the notification bell, and toasts. Everything else is server-rendered. Each new `"use client"` must be justifiable in one sentence.

**Component hierarchy.**

```text
Primitive (components/ui)        Button, Input, Select, Dialog, Popover, Badge, Card, Tabs
        ▲
Composite (components/*)         FormField, DataTable, Pagination, EmptyState, ConfirmDialog, PageHeader
        ▲
Feature (features/*)             ConsultantCard, SlotPicker, BookingSummary, AppointmentRow, VerificationQueue
        ▲
Route (app/*)                    Page/layout composition + data fetching
```

**Data flow.** Page (Server Component) → DAL read → DTO → props → feature component. Mutations flow the other way: client form → Server Action → service → `updateTag`/`revalidateTag` → RSC re-render.

**Navigation.** `typedRoutes` is on, so every `<Link href>` is compile-time checked. Dynamic segments use template literals (`` `/consultants/${slug}` ``).

---

## 7. Backend architecture

**Service layer contract.** Each domain service exports pure-ish async functions that take an explicit `actor` (the resolved session user) plus validated input, and return domain objects or throw `AppError`. Example shapes (signatures only — not implementations):

```text
server/services/booking.ts
  createAppointment(actor, { consultantSlug, startsAt, consultationType, clientNote })
  cancelAppointment(actor, { appointmentId, reason })
  rescheduleAppointment(actor, { appointmentId, newStartsAt })
  markCompleted(actor, { appointmentId })  |  markNoShow(actor, { appointmentId })

server/services/availability.ts
  getBookableSlots({ consultantId, rangeStart, rangeEnd, viewerTimezone })
  upsertRule(actor, input) | deleteRule(actor, id) | upsertException(actor, input)

server/services/consultants.ts
  searchConsultants(filters, pagination)  |  getPublicProfile(slug)
  updateProfile(actor, input)  |  setSpecializations(actor, ids)

server/services/admin.ts
  approveConsultant(actor, id) | rejectConsultant(actor, id, reason) | suspendConsultant(actor, id, reason)
  setUserStatus(actor, id, status) | listAuditLog(filters)
```

**Transactions.** Any operation that writes more than one row runs inside `prisma.$transaction`. The booking transaction is described in §18. Notification rows are written inside the same transaction as the mutation that caused them, so a user is never notified about a change that rolled back.

**Compare-and-set for state transitions.** Status changes use conditional updates (`updateMany({ where: { id, status: <expected> } })`) and treat a zero-row result as a conflict. This removes read-modify-write races without a version column on every table.

**Idempotency.** Booking submissions carry a client-generated `requestId` (a UUID rendered into the form). The booking service records it on the appointment with a unique index, so a double-submitted form produces one appointment, and the second attempt returns the first result.

**Background work.** `after()` from `next/server` handles non-critical post-response work (audit shipping, analytics). Time-driven work (mark past appointments complete, send reminders, prune expired sessions, drain the email outbox) runs through `/api/cron/*` handlers invoked by the platform scheduler with a shared secret.

---

## 8. Database architecture

PostgreSQL via Prisma. All timestamps are `timestamptz` (`@db.Timestamptz(3)`). All money is integer minor units plus an ISO-4217 currency code. All identifiers are opaque; public consultant URLs use a separate human-readable `slug`.

### 8.1 Enums

```text
UserRole            CLIENT | CONSULTANT | ADMIN
UserStatus          ACTIVE | SUSPENDED | DEACTIVATED
VerificationStatus  PENDING | APPROVED | REJECTED | SUSPENDED
ConsultationType    ONLINE | IN_PERSON
AppointmentStatus   PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW
CancelledBy         CLIENT | CONSULTANT | ADMIN | SYSTEM
AvailabilityExceptionType  BLOCK | EXTRA
NotificationType    APPOINTMENT_REQUESTED | APPOINTMENT_CONFIRMED | APPOINTMENT_CANCELLED |
                    APPOINTMENT_RESCHEDULED | APPOINTMENT_REMINDER | APPOINTMENT_COMPLETED |
                    REVIEW_RECEIVED | CONSULTANT_APPROVED | CONSULTANT_REJECTED | CONSULTANT_SUSPENDED
NoteVisibility      CONSULTANT_ONLY | SHARED
OutboxStatus        PENDING | SENT | FAILED
AuditAction         USER_SUSPENDED | USER_REACTIVATED | USER_ROLE_CHANGED | CONSULTANT_APPROVED |
                    CONSULTANT_REJECTED | CONSULTANT_SUSPENDED | APPOINTMENT_CANCELLED_BY_ADMIN |
                    SPECIALIZATION_CREATED | SPECIALIZATION_UPDATED | SPECIALIZATION_DISABLED |
                    REVIEW_UNPUBLISHED
```

### 8.2 Entities

Attributes are listed as `name : type` with constraints in the right column. `?` marks nullable.

#### User

| Attribute             | Type       | Constraint / note                                                                |
| --------------------- | ---------- | -------------------------------------------------------------------------------- |
| id                    | string     | PK                                                                               |
| email                 | string     | **unique**, stored lowercase-normalized, ≤ 254 chars                             |
| emailVerifiedAt       | datetime?  | null until verified                                                              |
| passwordHash          | string     | Argon2id encoded string. Never selected by any read DTO                          |
| role                  | UserRole   | default `CLIENT`                                                                 |
| status                | UserStatus | default `ACTIVE`                                                                 |
| fullName              | string     | 2–100 chars                                                                      |
| timezone              | string     | IANA zone, default `UTC`, validated against `Intl.supportedValuesOf('timeZone')` |
| locale                | string     | default `en`                                                                     |
| failedLoginCount      | int        | default 0                                                                        |
| lockedUntil           | datetime?  | set by login throttling                                                          |
| createdAt / updatedAt | datetime   |                                                                                  |
| deletedAt             | datetime?  | soft delete; excluded from every query by default                                |

Indexes: unique(`email`); (`role`, `status`); (`createdAt`).

#### Session

| Attribute  | Type      | Constraint / note                                                              |
| ---------- | --------- | ------------------------------------------------------------------------------ |
| id         | string    | PK                                                                             |
| userId     | string    | FK → User, **cascade delete**                                                  |
| tokenHash  | string    | **unique**. SHA-256 of the random 32-byte cookie token. Raw token never stored |
| expiresAt  | datetime  | absolute expiry                                                                |
| lastUsedAt | datetime  | drives sliding renewal                                                         |
| revokedAt  | datetime? | set on logout / suspension / password change                                   |
| ipHash     | string?   | hashed, for anomaly detection only                                             |
| userAgent  | string?   | truncated to 200 chars                                                         |
| createdAt  | datetime  |                                                                                |

Indexes: unique(`tokenHash`); (`userId`, `revokedAt`); (`expiresAt`).

#### VerificationToken _(covers email verification and password reset)_

`id`, `userId` (FK cascade), `type` (`EMAIL_VERIFICATION | PASSWORD_RESET`), `tokenHash` **unique**, `expiresAt`, `consumedAt?`, `createdAt`. Index (`userId`, `type`).

#### ClientProfile

| Attribute                                    | Type     | Constraint / note                                            |
| -------------------------------------------- | -------- | ------------------------------------------------------------ |
| id                                           | string   | PK                                                           |
| userId                                       | string   | FK → User, **unique** (1:1), cascade delete                  |
| displayName                                  | string   | what a consultant sees; defaults to first name               |
| phone                                        | string?  | E.164, optional, never public                                |
| dateOfBirth                                  | date?    | optional; used only for age-appropriateness checks           |
| preferredLanguageIds                         | relation | many-to-many with `Language`                                 |
| emergencyContactName / emergencyContactPhone | string?  | optional, consultant-visible only for confirmed appointments |
| createdAt / updatedAt                        | datetime |                                                              |

#### ConsultantProfile

| Attribute                    | Type               | Constraint / note                                         |
| ---------------------------- | ------------------ | --------------------------------------------------------- |
| id                           | string             | PK                                                        |
| userId                       | string             | FK → User, **unique** (1:1), cascade delete               |
| slug                         | string             | **unique**, URL-safe, generated from name + disambiguator |
| headline                     | string             | ≤ 120 chars                                               |
| bio                          | text               | 50–4000 chars                                             |
| yearsOfExperience            | int                | 0–70                                                      |
| sessionPriceMinor            | int                | > 0                                                       |
| currency                     | char(3)            | ISO 4217                                                  |
| sessionDurationMinutes       | int                | one of {30, 45, 50, 60, 90}                               |
| bufferMinutes                | int                | 0–60, default 10                                          |
| minLeadTimeHours             | int                | 0–168, default 12                                         |
| maxAdvanceDays               | int                | 1–180, default 60                                         |
| cancellationWindowHours      | int                | 0–168, default 24                                         |
| consultationTypes            | ConsultationType[] | non-empty                                                 |
| addressLine / city / country | string?            | required when `IN_PERSON` is offered                      |
| timezone                     | string             | IANA zone. **Authoritative for availability rules**       |
| verificationStatus           | VerificationStatus | default `PENDING`                                         |
| verificationReviewedAt       | datetime?          |                                                           |
| verificationReviewedById     | string?            | FK → User (admin)                                         |
| rejectionReason              | string?            |                                                           |
| autoConfirmBookings          | boolean            | default `false`                                           |
| isAcceptingBookings          | boolean            | default `true`                                            |
| ratingSum                    | int                | denormalized, default 0                                   |
| ratingCount                  | int                | denormalized, default 0                                   |
| publishedAt                  | datetime?          | set on first approval                                     |
| createdAt / updatedAt        | datetime           |                                                           |

Indexes: unique(`userId`); unique(`slug`); (`verificationStatus`, `isAcceptingBookings`); (`sessionPriceMinor`); (`ratingCount`, `ratingSum`); GIN full-text index on (`headline`, `bio`) for search.

#### Qualification

`id`, `consultantProfileId` (FK cascade), `title`, `institution`, `awardedYear` (1900…current), `credentialId?`, `documentUrl?` (private, admin-only), `createdAt`. Index (`consultantProfileId`).

#### Specialization

`id`, `slug` **unique**, `name` **unique**, `description?`, `isActive` (default true), `sortOrder` (int), `createdAt`, `updatedAt`. Index (`isActive`, `sortOrder`).

#### ConsultantSpecialization _(join)_

`consultantProfileId` (FK cascade), `specializationId` (FK restrict). **Composite PK** (`consultantProfileId`, `specializationId`). Index (`specializationId`) for reverse lookup. Restrict on delete prevents deleting a specialization that is in use — admins disable instead.

#### Language + ConsultantLanguage + ClientLanguage

`Language`: `id`, `code` (ISO 639-1) **unique**, `name` **unique**. Joins carry composite PKs, cascade from the profile side, restrict from the language side.

#### AvailabilityRule _(recurring weekly, wall-clock in the consultant's timezone)_

| Attribute             | Type     | Constraint / note                             |
| --------------------- | -------- | --------------------------------------------- |
| id                    | string   | PK                                            |
| consultantProfileId   | string   | FK cascade                                    |
| weekday               | int      | 0–6, 0 = Monday                               |
| startMinute           | int      | 0–1439, minutes from local midnight           |
| endMinute             | int      | 1–1440, **must exceed** `startMinute` (CHECK) |
| effectiveFrom         | date     | default today                                 |
| effectiveUntil        | date?    | null = open-ended                             |
| isActive              | boolean  | default true                                  |
| createdAt / updatedAt | datetime |                                               |

Indexes: (`consultantProfileId`, `weekday`, `isActive`). CHECK constraints: `startMinute >= 0 AND endMinute <= 1440 AND startMinute < endMinute`. Overlap between two active rules for the same consultant/weekday is rejected in the service layer (a DB exclusion constraint is impractical here because the ranges are integers scoped by date validity; the service check plus a covering test is the chosen trade-off).

#### AvailabilityException

`id`, `consultantProfileId` (FK cascade), `date` (local date in consultant tz), `type` (`BLOCK | EXTRA`), `startMinute?`, `endMinute?` (null/null on a `BLOCK` means the whole day), `reason?`, `createdAt`. Unique(`consultantProfileId`, `date`, `type`, `startMinute`). Index (`consultantProfileId`, `date`).

#### Appointment

| Attribute                               | Type              | Constraint / note                                                  |
| --------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| id                                      | string            | PK                                                                 |
| clientProfileId                         | string            | FK → ClientProfile, **restrict**                                   |
| consultantProfileId                     | string            | FK → ConsultantProfile, **restrict**                               |
| startsAt                                | timestamptz       | UTC instant                                                        |
| endsAt                                  | timestamptz       | UTC instant, **must exceed** `startsAt` (CHECK)                    |
| clientTimezone                          | string            | IANA zone captured at booking time, for correct historical display |
| consultantTimezone                      | string            | snapshot of the consultant zone at booking time                    |
| status                                  | AppointmentStatus | default `PENDING` or `CONFIRMED` when `autoConfirmBookings`        |
| consultationType                        | ConsultationType  | must be offered by the consultant                                  |
| priceMinor / currency                   | int / char(3)     | price snapshot at booking time                                     |
| sessionDurationMinutes                  | int               | snapshot                                                           |
| clientNote                              | text?             | ≤ 1000 chars, visible to the consultant only                       |
| requestIdempotencyKey                   | string?           | **unique**; de-duplicates double submits                           |
| confirmedAt / completedAt / cancelledAt | datetime?         |                                                                    |
| cancelledById                           | string?           | FK → User                                                          |
| cancelledBy                             | CancelledBy?      |                                                                    |
| cancellationReason                      | string?           | ≤ 500 chars                                                        |
| rescheduledFromId                       | string?           | FK → Appointment, **unique**, self-relation                        |
| remindersSentAt                         | datetime[]?       | or a child table if reminder types multiply                        |
| createdAt / updatedAt                   | datetime          |                                                                    |

Indexes: (`consultantProfileId`, `startsAt`); (`clientProfileId`, `startsAt` desc); (`status`, `startsAt`) for cron sweeps; unique(`requestIdempotencyKey`); unique(`rescheduledFromId`).
**Overlap constraint (the critical one):**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Appointment" ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    "consultantProfileId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE (status IN ('PENDING', 'CONFIRMED'));
```

A second, identical constraint keyed on `clientProfileId` prevents a client from double-booking themselves across different consultants.

#### AppointmentNote

`id`, `appointmentId` (FK cascade), `authorUserId` (FK restrict), `body` (encrypted at the application layer, see §17), `visibility` (`CONSULTANT_ONLY` default), `createdAt`, `updatedAt`. Index (`appointmentId`).

#### Review

| Attribute             | Type     | Constraint / note                                         |
| --------------------- | -------- | --------------------------------------------------------- |
| id                    | string   | PK                                                        |
| appointmentId         | string   | FK → Appointment, **unique** (one review per appointment) |
| clientProfileId       | string   | FK restrict                                               |
| consultantProfileId   | string   | FK restrict                                               |
| rating                | int      | CHECK 1–5                                                 |
| comment               | text?    | ≤ 2000 chars                                              |
| isPublished           | boolean  | default true; admins can unpublish                        |
| moderatedById         | string?  | FK → User                                                 |
| createdAt / updatedAt | datetime |                                                           |

Indexes: unique(`appointmentId`); (`consultantProfileId`, `isPublished`, `createdAt` desc).

#### Notification

`id`, `userId` (FK cascade), `type` (NotificationType), `payload` (jsonb — IDs and display-safe strings only, never clinical content), `readAt?`, `createdAt`. Indexes: (`userId`, `createdAt` desc); partial index on (`userId`) `WHERE "readAt" IS NULL` for the unread badge.

#### EmailOutbox _(written from day one, drained once a provider exists)_

`id`, `userId?`, `toEmail`, `template`, `payload` (jsonb), `status` (OutboxStatus), `attempts` (int), `lastError?`, `availableAt`, `sentAt?`, `createdAt`. Index (`status`, `availableAt`).

#### AuditLog

`id`, `actorUserId` (FK restrict), `action` (AuditAction), `entityType`, `entityId`, `metadata` (jsonb, redacted), `ipHash?`, `createdAt`. Indexes: (`actorUserId`, `createdAt` desc); (`entityType`, `entityId`); (`action`, `createdAt` desc). Append-only: no update or delete paths exist in the application.

#### RateLimitCounter _(only if Redis is not provisioned)_

`key` (PK), `windowStart`, `count`, `expiresAt`. Index (`expiresAt`).

### 8.3 Relationships and cardinality

```text
User 1 ──── 0..1 ClientProfile                (a CLIENT has exactly one; others have none)
User 1 ──── 0..1 ConsultantProfile            (a CONSULTANT has exactly one; others have none)
User 1 ──── 0..* Session                      cascade
User 1 ──── 0..* Notification                 cascade
User 1 ──── 0..* VerificationToken            cascade
User 1 ──── 0..* AuditLog (as actor)          restrict
ConsultantProfile 1 ──── 0..* Qualification            cascade
ConsultantProfile *  ──── *   Specialization           via ConsultantSpecialization
ConsultantProfile *  ──── *   Language                 via ConsultantLanguage
ClientProfile     *  ──── *   Language                 via ClientLanguage
ConsultantProfile 1 ──── 0..* AvailabilityRule         cascade
ConsultantProfile 1 ──── 0..* AvailabilityException    cascade
ClientProfile     1 ──── 0..* Appointment              restrict
ConsultantProfile 1 ──── 0..* Appointment              restrict
Appointment 1 ──── 0..1 Review                         cascade
Appointment 1 ──── 0..* AppointmentNote                cascade
Appointment 0..1 ──── 0..1 Appointment (rescheduledFrom / rescheduledTo)
```

**Delete semantics.** Profiles cascade from `User`, so a hard account deletion removes profile rows — but appointments are `restrict`, which means a user with appointment history cannot be hard-deleted. That is intentional: deletion is a soft delete plus anonymization (§17), preserving the other party's record of the session.

### 8.4 Unique constraints, checks, and invariants

| Kind                                            | Rule                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unique                                          | `User.email`, `Session.tokenHash`, `VerificationToken.tokenHash`, `ClientProfile.userId`, `ConsultantProfile.userId`, `ConsultantProfile.slug`, `Specialization.slug`, `Specialization.name`, `Language.code`, `Review.appointmentId`, `Appointment.requestIdempotencyKey`, `Appointment.rescheduledFromId`, `(consultantProfileId, specializationId)`, `(consultantProfileId, date, type, startMinute)` |
| Exclusion                                       | No two `PENDING`/`CONFIRMED` appointments may overlap for the same consultant, or for the same client                                                                                                                                                                                                                                                                                                    |
| Check                                           | `Appointment.endsAt > startsAt`; `Review.rating BETWEEN 1 AND 5`; `AvailabilityRule.startMinute < endMinute`; `ConsultantProfile.sessionPriceMinor > 0`; `ConsultantProfile.ratingCount >= 0`                                                                                                                                                                                                            |
| Application invariant (tested, not DB-enforced) | A `CONSULTANT` user must own exactly one `ConsultantProfile`; appointment status transitions must follow the state machine in §18; only `APPROVED` consultants appear in discovery; only `COMPLETED` appointments may be reviewed                                                                                                                                                                        |

### 8.5 Query and index notes

- Discovery filters on `verificationStatus = APPROVED AND isAcceptingBookings = true`, then narrows by specialization (join), language (join), price range, consultation type, and free text. The composite index plus the GIN text index covers the common paths; keyset pagination is used beyond page 5 to avoid deep `OFFSET` scans.
- Slot generation reads one consultant's rules, exceptions, and active appointments within a bounded window — all covered by `(consultantProfileId, …)` indexes.
- Rating aggregates are denormalized on `ConsultantProfile` and updated inside the review transaction, so sorting by rating never triggers an aggregate scan.

---

## 9. Authentication architecture

**Approach:** first-party email + password with **database-backed opaque sessions**. Rationale and the rejected Auth.js option are in [ADR-002](./ADR.md#adr-002--authentication-approach). Summary: credentials logins in Auth.js v5 force a JWT session strategy, which cannot revoke a suspended consultant's access until the token expires. Immediate revocation is a product requirement here.

**Registration**

1. Server Action validates with Zod (email format, password ≥ 12 chars with a character-class rule, name, accepted terms, chosen role of `CLIENT` or `CONSULTANT` — `ADMIN` is never self-assignable).
2. Email is normalized to lowercase and checked for uniqueness. The response is identical whether or not the address exists (generic "check your inbox") to avoid account enumeration.
3. Password is hashed with Argon2id using parameters pinned in `config/security.ts`.
4. `User` + the matching profile row are created in one transaction. Consultants are created with `verificationStatus = PENDING`.
5. An email-verification token (random 32 bytes, stored as a SHA-256 hash, 24-hour TTL) is written to `VerificationToken` and queued in `EmailOutbox`.
6. A session is created and the user lands on the role-appropriate onboarding page. Unverified accounts may browse and manage their profile but **cannot book or be booked** until `emailVerifiedAt` is set.

**Login**

1. Rate limit by IP and by email (§16).
2. Look up the user; always run a hash comparison (against a dummy hash when the user is absent) so timing does not leak existence.
3. On failure: increment `failedLoginCount`; after 10 failures set `lockedUntil = now + 15 min`; return one generic error.
4. On success: reset counters, create a `Session`, set the cookie, redirect by role.

**Session mechanics**

- Token: 32 cryptographically random bytes, base64url-encoded, sent to the browser; only its SHA-256 hash is stored.
- Cookie: name `session`; `httpOnly`, `secure` (always in production; permitted to be false only on `http://localhost` in development), `sameSite: 'lax'`, `path: '/'`, `expires` = absolute expiry.
- Lifetime: 7-day absolute expiry, with sliding renewal — when a session is used and `lastUsedAt` is older than 24 hours, both the row and the cookie are extended. Renewal happens in a Server Action or Route Handler, never during render (Next.js forbids cookie writes in render).
- Revocation: logout revokes the current session; password change, admin suspension, and "sign out everywhere" revoke all of a user's sessions. Because the session is a database row, revocation is immediate.
- Rotation: a new session row is issued on privilege-relevant events (password change, role change) and the old one is revoked.

**Reading the session (the DAL).**

```text
server/auth/dal.ts
  getSession()      cache()-memoized per request: read cookie → hash → look up non-revoked,
                    non-expired Session joined to a minimal User projection
                    (id, role, status, emailVerifiedAt, fullName, timezone)
  getCurrentUser()  getSession() or null
  requireUser()     getCurrentUser() or redirect('/login?next=…')
```

`cache()` from React memoizes within a single render pass, so a page that checks the session in five components performs one database read.

**Password reset.** Request → always respond "if that address exists, we sent a link" → token (32 bytes, hashed, 1-hour TTL, single-use) → reset form → on success: update hash, consume token, revoke all sessions, notify by email.

**What is deliberately absent in v1:** OAuth/social login, magic links, MFA. The `User` model leaves room for all three (add an `Account` table for OAuth, a `totpSecret` column for MFA) without restructuring.

---

## 10. Authorization / RBAC

**Model:** three fixed roles plus resource ownership. Role alone is never sufficient for resource access — ownership is always re-checked against the row.

**Permission matrix** (lives in `config/roles.ts` as data, and is the source for the authorization test suite):

| Capability                                    | Visitor |             CLIENT              |     CONSULTANT      |          ADMIN           |
| --------------------------------------------- | :-----: | :-----------------------------: | :-----------------: | :----------------------: |
| Browse approved consultants / public profiles |   ✅    |               ✅                |         ✅          |            ✅            |
| View a consultant's free slots                |   ✅    |               ✅                |         ✅          |            ✅            |
| Register / log in                             |   ✅    |                —                |          —          |            —             |
| Book an appointment                           |   ❌    |       ✅ (verified email)       |         ❌          |            ❌            |
| View own appointments                         |   ❌    |               ✅                |         ✅          |            —             |
| View another user's appointments              |   ❌    |               ❌                |         ❌          |    ✅ (metadata only)    |
| Cancel an appointment                         |   ❌    |       own, within policy        |         own         | any, with reason + audit |
| Reschedule an appointment                     |   ❌    |       own, within policy        |         own         |            ❌            |
| Mark completed / no-show                      |   ❌    |               ❌                | own, after `endsAt` |            ✅            |
| Read appointment `clientNote`                 |   ❌    |          own (author)           |  own appointments   |            ❌            |
| Read/write private `AppointmentNote`          |   ❌    |               ❌                |  own appointments   |            ❌            |
| Edit own client profile                       |   ❌    |               ✅                |          —          |     ❌ (status only)     |
| Edit own consultant profile                   |   ❌    |               ❌                |         ✅          |     ❌ (status only)     |
| Edit another user's profile                   |   ❌    |               ❌                |         ❌          |            ❌            |
| Manage own availability                       |   ❌    |               ❌                | ✅ (APPROVED only)  |            ❌            |
| Leave a review                                |   ❌    | own COMPLETED appointment, once |         ❌          |            ❌            |
| Unpublish a review                            |   ❌    |               ❌                |         ❌          |            ✅            |
| Approve / reject / suspend consultants        |   ❌    |               ❌                |         ❌          |            ✅            |
| Suspend / reactivate users                    |   ❌    |               ❌                |         ❌          |            ✅            |
| Change a user's role                          |   ❌    |               ❌                |         ❌          |            ✅            |
| Manage specializations                        |   ❌    |               ❌                |         ❌          |            ✅            |
| Read audit log                                |   ❌    |               ❌                |         ❌          |            ✅            |

**Explicit non-permissions worth stating:** an ADMIN cannot read `clientNote`, `AppointmentNote` bodies, or a client's emergency contact. Admin power is operational, not clinical. A CONSULTANT cannot see another consultant's appointments, availability, or client list. A CLIENT cannot see who else booked a consultant, nor any slot's occupant — an unavailable slot is simply absent from the response.

**Enforcement layers** (in order of authority):

1. **Domain services / DAL — authoritative.** Every function takes an actor and calls a guard, then re-checks row ownership (`appointment.clientProfile.userId === actor.id`). This is the layer a security review should audit.
2. **Server Actions and Route Handlers.** Each one re-derives the session independently. Next.js documents that a page-level check does **not** protect the actions defined on that page.
3. **Server Components.** Pages call `requireRole(...)` before rendering to produce the right UI and status, and layouts do _not_ rely on this (layouts do not re-render on navigation, and hiding children does not stop them rendering).
4. **`proxy.ts` — UX only.** Reads the session cookie's presence (no database call, because Proxy runs on prefetches too) and redirects anonymous users away from `/dashboard`, `/consultant/*`, `/admin/*` and authenticated users away from `/login`, `/register`. A forged cookie gets past it and is stopped by layer 1.
5. **Client components.** Hide controls the user cannot use. Cosmetic only.

**Guards** (`server/authz/guards.ts`): `requireUser()`, `requireRole(role)`, `requireClient()`, `requireConsultant({ approved?: boolean })`, `requireAdmin()`, `requireVerifiedEmail()`, `assertOwnsAppointment(actor, appointment)`, `assertOwnsProfile(actor, profile)`.

**Route protection map**

| Path prefix                                                                          | Requirement                                                                             |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `/`, `/consultants`, `/consultants/[slug]`, `/legal/*`, `/help`, `/crisis-resources` | public                                                                                  |
| `/login`, `/register`, `/forgot-password`, `/reset-password/*`                       | anonymous only (redirect if signed in)                                                  |
| `/dashboard`, `/appointments/*`, `/profile`, `/notifications`                        | CLIENT, active                                                                          |
| `/consultants/[slug]/book`                                                           | CLIENT, active, verified email                                                          |
| `/consultant/*`                                                                      | CONSULTANT, active; availability and booking management additionally require `APPROVED` |
| `/admin/*`                                                                           | ADMIN, active                                                                           |

---

## 11. API architecture

Most "API areas" in this system are **Server Actions**, not HTTP endpoints, because the UI is server-rendered. Route Handlers are created only where a real network endpoint is needed: machine callers (cron), infrastructure (health), and a few client-side JSON reads that benefit from HTTP caching. This is a deliberate deviation from a conventional `/api/*` layout and is recorded in [ADR-005](./ADR.md#adr-005--server-actions-vs-route-handlers).

Common conventions for every Route Handler:

- Response envelope: `{ data }` on success, `{ error: { code, message, details? } }` on failure. Never a raw exception message.
- Status codes: `200`/`201` success · `400` validation · `401` unauthenticated · `403` forbidden · `404` not found _(also used for IDOR-resistant "not yours")_ · `409` conflict (slot taken, state conflict) · `422` semantic rejection (past slot, outside availability) · `429` rate limited · `500` unexpected.
- Every handler: parse `params`/`searchParams`/body with Zod → resolve session → authorize → call service → map `AppError` to status.
- No handler returns a Prisma model directly; DTOs only.

### 11.1 Route Handler surface

| Route                                  | Method | Purpose                                                             | Auth                                 | Authorization                                        | Input validation                                                            | Success response                                                          | Error cases                                             |
| -------------------------------------- | ------ | ------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `/api/health`                          | GET    | Liveness + database ping for the platform                           | none                                 | none                                                 | none                                                                        | `{ status, version, db: 'ok' }`                                           | 503 when the database is unreachable                    |
| `/api/consultants/[slug]/availability` | GET    | Slots for the picker, fetched on date-range change                  | optional                             | Consultant must be `APPROVED` and accepting bookings | `slug` (slug schema), `from`/`to` (ISO dates, range ≤ 31 days), `tz` (IANA) | `{ data: { timezone, days: [{ date, slots: [{ startsAt, endsAt }] }] } }` | 400 bad range · 404 unknown/unapproved consultant · 429 |
| `/api/consultants/search`              | GET    | Typeahead for the discovery search box                              | optional                             | approved-only filter applied server-side             | `q` (1–80 chars), `limit` ≤ 10                                              | `{ data: [{ slug, fullName, headline }] }`                                | 400 · 429                                               |
| `/api/notifications/unread-count`      | GET    | Badge polling (30 s interval, only while the tab is visible)        | required                             | own user only                                        | none                                                                        | `{ data: { count } }`                                                     | 401 · 429                                               |
| `/api/cron/complete-appointments`      | POST   | Transition past `CONFIRMED` appointments to `COMPLETED`             | `Authorization: Bearer $CRON_SECRET` | machine only                                         | none                                                                        | `{ data: { updated } }`                                                   | 401 on bad secret                                       |
| `/api/cron/send-reminders`             | POST   | Queue 24 h / 1 h reminders into the outbox                          | `$CRON_SECRET`                       | machine only                                         | none                                                                        | `{ data: { queued } }`                                                    | 401                                                     |
| `/api/cron/drain-outbox`               | POST   | Send queued emails once a provider is configured                    | `$CRON_SECRET`                       | machine only                                         | none                                                                        | `{ data: { sent, failed } }`                                              | 401 · 503 when no provider                              |
| `/api/cron/prune`                      | POST   | Delete expired sessions/tokens, expire stale `PENDING` appointments | `$CRON_SECRET`                       | machine only                                         | none                                                                        | `{ data: { … } }`                                                         | 401                                                     |

`/api/auth/*` is intentionally **not** created — authentication is handled by Server Actions, which get Next.js's action-ID protection and origin checking for free, and never expose a credential-accepting JSON endpoint. If a mobile client is ever added, a versioned `/api/v1/*` surface is introduced then, reusing the same services.

### 11.2 Server Action catalogue (the real "API")

Every action lives beside its feature, is `"use server"`, validates input, resolves the session itself, calls exactly one service function, and returns `Result<T>`.

| Area          | Action                                                                                                                                      | Auth                        | Authorization               | Key failures                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| auth          | `registerAction`                                                                                                                            | none                        | role ∈ {CLIENT, CONSULTANT} | `EMAIL_TAKEN` (generic response), `VALIDATION`                                                                                              |
| auth          | `loginAction`                                                                                                                               | none                        | —                           | `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `RATE_LIMITED`                                                                                     |
| auth          | `logoutAction`, `logoutAllAction`                                                                                                           | required                    | own sessions                | —                                                                                                                                           |
| auth          | `requestPasswordResetAction`, `resetPasswordAction`, `verifyEmailAction`                                                                    | none                        | token bound to user         | `TOKEN_INVALID`, `TOKEN_EXPIRED`                                                                                                            |
| profile       | `updateClientProfileAction`                                                                                                                 | CLIENT                      | own profile                 | `VALIDATION`                                                                                                                                |
| profile       | `updateConsultantProfileAction`, `upsertQualificationAction`, `deleteQualificationAction`, `setSpecializationsAction`, `setLanguagesAction` | CONSULTANT                  | own profile                 | `VALIDATION`, `FORBIDDEN`                                                                                                                   |
| availability  | `upsertAvailabilityRuleAction`, `deleteAvailabilityRuleAction`, `upsertAvailabilityExceptionAction`, `deleteAvailabilityExceptionAction`    | CONSULTANT (APPROVED)       | own profile                 | `RULE_OVERLAP`, `CONFLICTS_WITH_BOOKED_APPOINTMENTS`, `VALIDATION`                                                                          |
| booking       | `createAppointmentAction`                                                                                                                   | CLIENT (verified)           | self as client              | `SLOT_TAKEN`, `SLOT_NOT_AVAILABLE`, `SLOT_IN_PAST`, `LEAD_TIME_VIOLATION`, `CONSULTANT_UNAVAILABLE`, `CLIENT_DOUBLE_BOOKED`, `RATE_LIMITED` |
| booking       | `cancelAppointmentAction`                                                                                                                   | CLIENT / CONSULTANT / ADMIN | participant or admin        | `NOT_FOUND`, `INVALID_STATE`, `CANCELLATION_WINDOW_CLOSED`                                                                                  |
| booking       | `rescheduleAppointmentAction`                                                                                                               | CLIENT / CONSULTANT         | participant                 | all booking failures + `RESCHEDULE_LIMIT_REACHED`                                                                                           |
| booking       | `confirmAppointmentAction`, `markCompletedAction`, `markNoShowAction`                                                                       | CONSULTANT                  | own appointment             | `INVALID_STATE`, `TOO_EARLY`                                                                                                                |
| notes         | `upsertAppointmentNoteAction`                                                                                                               | CONSULTANT                  | own appointment             | `FORBIDDEN`                                                                                                                                 |
| reviews       | `createReviewAction`, `updateReviewAction`                                                                                                  | CLIENT                      | own COMPLETED appointment   | `NOT_ELIGIBLE`, `ALREADY_REVIEWED`, `REVIEW_WINDOW_CLOSED`                                                                                  |
| notifications | `markNotificationReadAction`, `markAllReadAction`                                                                                           | required                    | own notifications           | `NOT_FOUND`                                                                                                                                 |
| admin         | `approveConsultantAction`, `rejectConsultantAction`, `suspendConsultantAction`, `reinstateConsultantAction`                                 | ADMIN                       | —                           | `INVALID_STATE`, `REASON_REQUIRED`                                                                                                          |
| admin         | `setUserStatusAction`, `changeUserRoleAction`                                                                                               | ADMIN                       | not self                    | `CANNOT_MODIFY_SELF`, `LAST_ADMIN`                                                                                                          |
| admin         | `createSpecializationAction`, `updateSpecializationAction`, `disableSpecializationAction`                                                   | ADMIN                       | —                           | `SLUG_TAKEN`, `IN_USE`                                                                                                                      |
| admin         | `adminCancelAppointmentAction`, `unpublishReviewAction`                                                                                     | ADMIN                       | —                           | `INVALID_STATE`                                                                                                                             |

---

## 12. Server Actions / Route Handlers strategy

**Use a Server Action when** the caller is this application's UI and the operation mutates state, or when a mutation must be co-located with the form that triggers it. That is the default for every write in this system.

**Use a Route Handler when** the caller is not a rendered page: cron/machine callers, health checks, webhooks (future), or a client-side `fetch` that wants HTTP caching and a plain JSON contract (the slot picker's range refresh, typeahead, the unread badge).

**Never** use a Route Handler as a general-purpose backend for the app's own forms. That would reimplement CSRF protection, action-ID secrecy, and progressive enhancement that Server Actions already provide.

**Action anatomy** (enforced by review, and by an ESLint boundary rule where practical):

```text
"use server"
1. rateLimit(key)                      // for unauthenticated or expensive actions
2. schema.safeParse(input)             // never trust FormData
3. const actor = await requireX()      // independent session resolution
4. const result = await service.fn(actor, parsed.data)
5. updateTag(`…`) / revalidateTag(`…`, 'max')
6. return ok(dto) | err(code, message, fieldErrors)
```

**Caching and invalidation.** Public, read-mostly data (consultant list pages, public profiles, the specialization taxonomy) is wrapped in cached read functions tagged `consultants:list`, `consultant:{slug}`, `specializations`. Availability is tagged `availability:{consultantId}`. After a mutation:

- inside a Server Action, use `updateTag(tag)` so the acting user immediately sees their own write;
- from a Route Handler (cron), use `revalidateTag(tag, 'max')` — the single-argument form is deprecated in Next.js 16;
- call `refresh()` when the client router must re-read the current route after a dialog-driven mutation.

**Redirects.** Services never redirect. Actions redirect after success (`redirect('/appointments/…')`), which is also how post-booking double-submits are avoided.

**Progressive enhancement.** Login, registration, profile edit, and cancellation forms work without JavaScript (plain `<form action={…}>`). The slot picker and availability editor require JavaScript and say so in their no-JS fallback.

---

## 13. State management strategy

No global client state library. State is placed in the narrowest scope that works:

| State                                                                | Home                                                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Domain data (consultants, appointments, availability, notifications) | Server. Fetched in Server Components; re-fetched by tag invalidation after mutations                                             |
| Discovery filters, pagination, selected date                         | **URL `searchParams`** — shareable, back-button correct, server-readable. Written via `useRouter().replace` with `scroll: false` |
| Form field state                                                     | React Hook Form (multi-field) or uncontrolled DOM (single-field)                                                                 |
| Action lifecycle (pending/result/field errors)                       | `useActionState` + `useFormStatus`                                                                                               |
| Optimistic UI (marking a notification read, cancelling)              | `useOptimistic`, always reconciled by the server result                                                                          |
| Ephemeral UI (dialog open, tab, popover)                             | Local `useState` in the owning client component                                                                                  |
| Toasts                                                               | A single client-side toast host in the root layout, fed by action results                                                        |
| Session/user identity                                                | Server-resolved; passed down as props. Never mirrored into client state                                                          |

The session is never duplicated into a client store: a client-held role is a suggestion, and treating it as anything more is how privilege-escalation bugs start.

---

## 14. Validation strategy

**Single source.** Every input shape is a Zod schema in `schemas/`, imported by the client form (via `zodResolver`) _and_ the server boundary. Client-side validation is a UX affordance; the server re-parses everything, always.

**Boundaries that must parse:** Server Action arguments and `FormData`, Route Handler bodies, `params`, `searchParams`, cron payloads, and environment variables at boot (`config/env.ts` parses `process.env` once and exports a typed object; a missing `DATABASE_URL` fails fast at startup rather than at the first query).

**Layering.**

1. _Shape_ (Zod): types, lengths, ranges, formats, enum membership, cross-field rules (`endMinute > startMinute`, `password === confirmPassword`).
2. _Referential_ (service, inside the transaction): does this consultant exist, is this specialization active, does this appointment belong to the actor.
3. _Invariant_ (service): is the slot inside published availability, is the state transition legal, is the cancellation window open.
4. _Structural_ (database): uniqueness, foreign keys, checks, the overlap exclusion constraint.

A rule that matters is enforced at layer 3 or 4 — never only at layer 1.

**Shared schema examples:** `emailSchema`, `passwordSchema`, `ianaTimezoneSchema`, `slugSchema`, `paginationSchema`, `consultantFilterSchema`, `createAppointmentSchema`, `availabilityRuleSchema`, `reviewSchema`.

**`searchParams` are hostile input.** Discovery filters are parsed with `.catch()` defaults so a malformed query string renders an empty-but-valid result instead of a 500, and never reaches the query builder unparsed.

---

## 15. Error handling strategy

**Error taxonomy** (`server/errors.ts`):

```text
AppError (base: code, httpStatus, safeMessage, cause?)
├── ValidationError      400  field-level details
├── AuthenticationError  401  "Please sign in again."
├── AuthorizationError   403  "You don't have access to this."
├── NotFoundError        404  also used to mask another user's resource
├── ConflictError        409  SLOT_TAKEN, ALREADY_REVIEWED, INVALID_STATE
├── UnprocessableError   422  SLOT_IN_PAST, OUTSIDE_AVAILABILITY, WINDOW_CLOSED
└── RateLimitError       429  includes retryAfter
Unknown errors → logged with a correlation ID → generic 500 message
```

**Result type for actions** (`types/result.ts`):

```text
type Result<T> =
  | { ok: true;  data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> } }
```

Actions return `Result`; they do not throw for expected outcomes. Thrown `AppError`s are caught by the action wrapper and mapped. Unexpected throws are logged and mapped to a generic failure — the raw message never reaches the client.

**Route-level UI.** `app/error.tsx` per major segment (client, consultant, admin) with a reset button; `app/global-error.tsx` for the root; `app/not-found.tsx`; segment-level `loading.tsx`. Error components receive `{ error, reset }` and display `error.digest`, never `error.message`.

**Database error mapping.** Prisma `P2002` → `ConflictError`. Postgres SQLSTATE `23P01` (exclusion violation) → `SLOT_TAKEN`. `P2025` (record not found) → `NotFoundError`. `P2003` (FK violation) → `ConflictError`. The exact Prisma surface for exclusion violations is verified during Step 11 and pinned in a test.

**User-facing copy rules.** State what happened and what to do next, in plain language, without blame. "That time was booked a moment ago — here are the next available slots." Never show a stack trace, a SQL fragment, or an internal ID.

---

## 16. Security architecture

**Authentication security.** Argon2id with pinned parameters; passwords ≥ 12 characters checked against a small common-password deny-list; constant-work login path; lockout after 10 failures for 15 minutes; generic responses on registration, login, and password reset to prevent account enumeration; all sessions revoked on password change.

**Session/cookie handling.** `httpOnly`, `secure`, `sameSite=lax`, `path=/`, absolute expiry, opaque random token, hash-at-rest, server-side revocation, rotation on privilege change. No session data in `localStorage`. No JWT in a readable cookie.

**Authorization.** Enforced in services and the DAL (§10). Every action re-derives identity. Role is read from the session row, never from form data, headers, or `searchParams`.

**IDOR prevention.** Every read and write of an owned resource filters by owner in the `where` clause (`where: { id, clientProfile: { userId: actor.id } }`) rather than fetching then comparing. A miss returns **404, not 403**, so an attacker cannot enumerate valid IDs. IDs are opaque and non-sequential. The authorization test suite includes a cross-tenant probe for every owned resource.

**Rate limiting** (per IP and, where applicable, per account):

| Surface                                          | Budget                                                     |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `loginAction`                                    | 5 / 15 min per IP+email, 20 / 15 min per IP                |
| `registerAction`                                 | 5 / hour per IP                                            |
| `requestPasswordResetAction`                     | 3 / hour per email, 10 / hour per IP                       |
| `createAppointmentAction`                        | 10 / hour per user                                         |
| `createReviewAction`                             | 5 / day per user                                           |
| `/api/consultants/search`, `/api/*/availability` | 60 / min per IP                                            |
| `/api/notifications/unread-count`                | 120 / min per session                                      |
| `/api/cron/*`                                    | secret-gated; also IP-restricted where the platform allows |

Implemented behind one interface so the store can move from memory to Redis without touching call sites.

**CSRF.** Server Actions are POST-only, carry encrypted non-deterministic action IDs, and Next.js compares `Origin` against `Host`. `sameSite=lax` cookies cover the rest. If the app is ever served behind a proxy on a different host, `serverActions.allowedOrigins` must be set — noted in the deployment checklist. Mutating Route Handlers (cron) are secret-gated, not cookie-authenticated, so they are not CSRF-reachable.

**XSS.** React escapes by default; `dangerouslySetInnerHTML` is banned (ESLint rule). User-authored text (bio, reviews, notes) is stored raw and rendered as text, never as HTML. If rich text is ever needed, it goes through a server-side sanitizer with an allowlist. A strict CSP (below) is the second line.

**Security headers** (set in `next.config.ts` `headers()`, with the CSP nonce injected by `proxy.ts`):

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<random>' 'strict-dynamic';
                         style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: <image-host>;
                         font-src 'self'; connect-src 'self'; frame-ancestors 'none';
                         form-action 'self'; base-uri 'self'; object-src 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
X-Frame-Options: DENY        (belt-and-braces alongside frame-ancestors)
```

**Database access rules.** The application connects with a least-privilege role (`SELECT/INSERT/UPDATE/DELETE` on application tables, no `DDL` at runtime); migrations run as a separate privileged role in CI/CD. All access is through Prisma's parameterized queries. `$queryRawUnsafe` is banned; `$queryRaw` tagged templates are permitted only in `server/dal/**` and only with interpolated parameters. Connection pooling via PgBouncer (or the platform's pooler); `DATABASE_URL` uses the pooled endpoint and `DIRECT_URL` the direct one for migrations.

**API security.** Every handler validates and authorizes independently; no CORS headers are set (same-origin only) until a real cross-origin consumer exists; request bodies are size-limited; `OPTIONS` is left to the framework default.

**Environment secrets.** `.env*` is git-ignored except `.env.example`, which contains names and comments only. Secrets are read exclusively through `config/env.ts`. No secret is ever prefixed `NEXT_PUBLIC_`. Secret rotation procedure is documented in the README (Step 21). `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is set explicitly when running more than one instance, so action closures stay decryptable across servers.

**Dependency hygiene.** `pnpm audit` in CI, Dependabot/Renovate for updates, lockfile committed, `ignoredBuiltDependencies` reviewed.

**Deliberate non-claim.** See §17.

---

## 17. Privacy considerations

This platform handles information that reveals that a person sought psychological support, and who they saw and when. That fact alone is sensitive even without clinical content.

**No compliance claim.** This architecture does **not** claim HIPAA, GDPR, or any other regulatory compliance. The requirements for such claims depend on jurisdiction, the operating entity, contracts with processors, and operational controls outside this codebase. What is designed here are sound privacy engineering practices. Achieving a specific regulatory posture would additionally require, at minimum: a legal review of the processing basis, data-processing agreements (and BAAs where applicable) with every processor including the host and email provider, a documented retention schedule, a DSAR/erasure procedure, breach-notification runbooks, staff access controls and training, and an audited hosting region. Those are tracked as open items, not as implemented features.

**Data minimization.** Collect only what the booking flow needs. Date of birth, phone, and emergency contact are optional. No health data, diagnosis, medication, or insurance fields exist. `clientNote` is a short, optional free-text field with a stated purpose ("what would you like to focus on?") and a visible notice that it is shared with that consultant only.

**Visibility rules.**

| Data                                                                       | Who can see it                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Consultant professional profile, specializations, languages, price, rating | everyone (once `APPROVED`)                                                |
| Consultant email, phone, address details, qualification documents          | the consultant, and admins for verification only                          |
| Client identity (`displayName`)                                            | the consultant they booked, from the moment the appointment exists        |
| Client full name, email, phone, emergency contact                          | the consultant for `CONFIRMED`/`COMPLETED` appointments only              |
| `clientNote`                                                               | the client and their consultant                                           |
| `AppointmentNote` (consultant's private notes)                             | that consultant only — **not admins**                                     |
| Reviews                                                                    | public, attributed to a first name + initial, never to a client's account |
| The fact that a specific client booked a specific consultant               | the two parties; admins see it as metadata in the appointment list        |

**Encryption.** TLS in transit; disk encryption at rest from the database provider. `AppointmentNote.body` is additionally encrypted at the application layer (AES-256-GCM, key from `NOTES_ENCRYPTION_KEY`, per-row IV, key id stored for rotation) so a database dump does not expose session notes. Password and token material is hashed, never encrypted.

**Retention and deletion.** Notifications older than 180 days are pruned. Sessions and tokens are deleted after expiry. Audit logs are kept 24 months. Account deletion is a **soft delete plus anonymization**: `User.deletedAt` is set, sessions are revoked, email is replaced with a non-reversible tombstone, name becomes "Deleted user", profile free text and notes are erased — while appointment rows (times, status, price) survive so the other party keeps an accurate record. Hard deletion of appointment history is an operator procedure, not a self-service action.

**URLs and logs never carry sensitive data.** No email addresses, names, tokens, or note content in query strings, referrers, or log lines. Analytics, if added, must not record URLs containing consultant slugs alongside a user identifier.

**Public surface hardening.** `robots.txt` disallows `/dashboard`, `/appointments`, `/consultant`, `/admin`, and `/api`. Authenticated pages send `X-Robots-Tag: noindex`. Consultant public profiles are indexable; nothing else about a booking is.

---

## 18. Booking architecture

### 18.1 Model

Availability is **computed, not materialized**: there is no `Slot` table. A slot exists if the consultant's rules generate it, no exception blocks it, and no active appointment overlaps it. See [ADR-010](./ADR.md#adr-010--availability-representation) for why a materialized slot table was rejected.

An `Appointment` therefore _is_ the booking: it stores an absolute `[startsAt, endsAt)` interval in UTC, plus snapshots of price, duration, and both timezones as they were at booking time.

### 18.2 Appointment lifecycle

```text
                  ┌──────────────── consultant confirms ──────────────┐
                  │                                                   ▼
   (create) ─▶ PENDING ──────────────────────────────────────────▶ CONFIRMED
                  │                                                   │
                  │ client/consultant/admin cancels                   │ cancels (policy-checked)
                  │ or auto-expire (no response before startsAt)      │
                  ▼                                                   ▼
              CANCELLED ◀───────────────────────────────────────── CANCELLED
                                                                      │
                                    after endsAt, consultant or cron ─┤
                                                                      ├──▶ COMPLETED ──▶ (reviewable)
                                                                      └──▶ NO_SHOW
```

- Creation enters `CONFIRMED` directly when `autoConfirmBookings` is on; otherwise `PENDING`.
- `COMPLETED` and `NO_SHOW` are terminal. `CANCELLED` is terminal. No transition leaves a terminal state.
- Rescheduling is modelled as _cancel + create_, linked by `rescheduledFromId`, in one transaction.
- Every transition is a compare-and-set update guarded by the expected current status; a zero-row result is reported as `INVALID_STATE`.

### 18.3 Booking flow

```text
1. Client opens /consultants/[slug] and picks a date range.
2. Server (or /api/consultants/[slug]/availability) returns free slots, rendered in the client's timezone
   with the consultant's timezone shown alongside.
3. Client selects a slot → confirmation screen shows: consultant, local time, consultant-local time,
   duration, type, price, cancellation policy, and the optional note field.
4. Submit → createAppointmentAction:
      a. rate limit
      b. Zod parse (startsAt ISO instant, type, note ≤ 1000, idempotency key)
      c. requireClient() + requireVerifiedEmail()
      d. booking service transaction (below)
      e. updateTag(`availability:{consultantId}`), updateTag(`appointments:{userId}`)
      f. redirect to /appointments/[id]
5. Notifications are written inside the same transaction; email is queued to the outbox.
```

**The transaction** (`READ COMMITTED`, one round trip):

```text
BEGIN
  1. Load consultant profile FOR SHARE: must be APPROVED, ACTIVE, isAcceptingBookings,
     and must offer the requested consultationType.
  2. Recompute availability for the requested instant from rules + exceptions.
     Reject if the instant is not a valid slot start, or the derived end differs.
  3. Policy checks: startsAt >= now + minLeadTimeHours; startsAt <= now + maxAdvanceDays.
  4. INSERT Appointment (status, price/duration/timezone snapshots, idempotency key).
     ── the exclusion constraints decide the race, not the application ──
  5. INSERT Notification rows (client + consultant); INSERT EmailOutbox rows.
COMMIT
```

Failure mapping: exclusion violation on the consultant key → `SLOT_TAKEN`; on the client key → `CLIENT_DOUBLE_BOOKED`; unique violation on the idempotency key → return the existing appointment (success, not an error); step 2 failure → `SLOT_NOT_AVAILABLE`; step 3 failure → `SLOT_IN_PAST` / `LEAD_TIME_VIOLATION` / `TOO_FAR_AHEAD`.

### 18.4 Preventing double booking

Four independent mechanisms, in increasing order of authority:

1. The UI only offers free slots (cosmetic).
2. The service recomputes availability inside the transaction (catches stale UI).
3. **The Postgres exclusion constraint** makes an overlapping `PENDING`/`CONFIRMED` pair impossible — including under perfectly simultaneous transactions, which is precisely where an application-level "check then insert" fails.
4. A second exclusion constraint on the client prevents the same person from holding two overlapping appointments.

The constraint is filtered on `status IN ('PENDING','CONFIRMED')`, so cancelled and completed rows do not block re-booking the same time. Requires the `btree_gist` extension; the fallback if a hosting provider forbids it is a partial unique index on `(consultantProfileId, startsAt)` plus a service-level overlap check, which is correct only while every appointment for a consultant has the same duration — an explicit, documented downgrade.

### 18.5 Concurrent booking handling

Two clients submitting the same slot in the same millisecond: both pass step 2, both attempt the insert, Postgres serializes them, one commits, the other receives `23P01`. The loser's action returns `SLOT_TAKEN` with a refreshed slot list rendered inline, so recovery is one click. No retry loop, no lock queue, no lost booking. Booking is never retried automatically — silently moving someone to a different time is worse than an error.

### 18.6 Cancellation

- **Client:** allowed while `PENDING` or `CONFIRMED` and `now < startsAt - cancellationWindowHours`. Inside the window the UI explains the policy and offers "request cancellation", which notifies the consultant rather than cancelling automatically.
- **Consultant:** allowed at any time before `startsAt`, reason required, client notified immediately.
- **Admin:** allowed at any time, reason required, written to the audit log.
- Transaction: compare-and-set status → set `cancelledAt`, `cancelledBy`, `cancelledById`, `cancellationReason` → write notifications → invalidate `availability:{consultantId}`. The freed interval becomes bookable the moment the transaction commits, because the exclusion constraint's `WHERE` no longer matches the row.
- `COMPLETED` and `NO_SHOW` appointments can never be cancelled.

### 18.7 Rescheduling

Allowed for `PENDING`/`CONFIRMED` appointments, before `startsAt`, outside the cancellation window, and at most `maxReschedules` times (config, default 2 — tracked by walking the `rescheduledFromId` chain). One transaction: cancel the old row (`CANCELLED`, `cancelledBy = CLIENT|CONSULTANT`, reason `"rescheduled"`), insert the new row with `rescheduledFromId` set, run the full booking validation for the new instant. Because both happen in one transaction, the old slot is released and the new one is claimed atomically — including the case where the new time _is_ the old time shifted within the same hour.

### 18.8 Past-appointment prevention

`startsAt` must be `>= now + minLeadTimeHours` at insert time, checked inside the transaction against the database clock (`now()`), not the application clock, so a skewed app server cannot create a past booking. Slot generation never emits past slots. A `CHECK (endsAt > startsAt)` guards the interval itself.

### 18.9 Timezone handling

See §19.3 and [ADR-009](./ADR.md#adr-009--timezone-handling). In one line: instants are UTC `timestamptz`, availability rules are wall-clock in the consultant's IANA zone, and every rendered time states which zone it is in.

### 18.10 Transaction boundaries (summary)

| Operation                         | Boundary                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Register                          | user + profile + verification token (+ outbox)                                       |
| Book                              | consultant read + validation + appointment insert + notifications + outbox           |
| Cancel                            | status CAS + notifications + outbox                                                  |
| Reschedule                        | old cancel + new insert + notifications + outbox                                     |
| Complete / no-show                | status CAS + notification                                                            |
| Review                            | review insert + `ratingSum`/`ratingCount` increment on the consultant + notification |
| Approve/reject/suspend consultant | status change + audit log + notification (+ cancel future appointments on suspend)   |
| Availability edit                 | conflict check against active appointments + rule write                              |

---

## 19. Availability architecture

### 19.1 Composition

```text
bookable(consultant, day) =
      ⋃ active AvailabilityRules for that weekday, valid on that date   (wall-clock intervals)
    ∪ ⋃ EXTRA exceptions on that date
    ∖ ⋃ BLOCK exceptions on that date
    → convert wall-clock intervals to UTC instants in the consultant's zone
    → slice into slots of sessionDurationMinutes, stepping by (duration + bufferMinutes)
    → drop slots starting before now + minLeadTimeHours
    → drop slots starting after now + maxAdvanceDays
    ∖ intervals of PENDING/CONFIRMED appointments (plus buffer on both sides)
```

The generator is a **pure function** in `server/services/availability.ts` taking `{ rules, exceptions, appointments, policy, timezone, rangeStart, rangeEnd, now }` and returning slot instants. Pure means it is exhaustively unit-testable, including every DST case, without a database.

### 19.2 Editing availability

- The consultant edits a weekly grid (rule per weekday, multiple intervals allowed) plus a date-exception calendar.
- Two active rules for the same weekday may not overlap — checked in the service and covered by tests.
- An edit that would remove availability under an existing `PENDING`/`CONFIRMED` appointment is **rejected** with the conflicting appointments listed; the consultant must cancel or reschedule those first. Booked time always wins over a rule change.
- Changing `sessionDurationMinutes` or `bufferMinutes` re-slices future availability but never alters existing appointments, which carry their own duration snapshot.
- Changing the profile timezone is a distinct, confirmed action: rules are wall-clock, so moving zones shifts every future slot. The confirmation shows before/after times and lists affected appointments (which do not move, because they are absolute instants).

### 19.3 Timezone rules

- **Storage:** every instant is `timestamptz` in UTC. The database session timezone is irrelevant and never relied on.
- **Rules:** stored as weekday + minutes from local midnight, interpreted in `ConsultantProfile.timezone`. "Tuesdays 09:00–17:00" stays 09:00 local across DST, which is what a human means.
- **Conversion:** wall-clock → instant conversion uses the IANA database via `@date-fns/tz`. Spring-forward gaps (a local time that does not exist) drop the affected slots. Fall-back overlaps (a local time that occurs twice) resolve to the **first** occurrence; the second is dropped to avoid ambiguous bookings.
- **Display:** always in the viewer's timezone (`User.timezone`, defaulting to the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` captured at registration), with the consultant's local time shown alongside whenever the two differ, and the zone abbreviation always visible. Historical appointments render using the stored `clientTimezone` so a past appointment does not "move" after a user relocates.
- **Server formatting only.** Dates are formatted on the server and passed as pre-formatted strings plus the raw ISO instant, avoiding hydration mismatches between the server's zone and the browser's.
- **Never** use `new Date('2026-01-01')` (parsed as UTC midnight) or the server's local zone for anything user-visible. A lint rule and code review enforce this.

---

## 20. Notification architecture

**Channels:** in-app (v1), email (structure built in v1, delivery enabled when a provider is configured), SMS/push (out of scope).

**Events → recipients**

| Event                                      |           Client           |     Consultant     |     Admin     |
| ------------------------------------------ | :------------------------: | :----------------: | :-----------: |
| Appointment requested (`PENDING`)          | ✅ confirmation of request |  ✅ action needed  |       —       |
| Appointment confirmed                      |             ✅             |         ✅         |       —       |
| Appointment cancelled (any actor)          |             ✅             |         ✅         |       —       |
| Appointment rescheduled                    |             ✅             |         ✅         |       —       |
| Reminder, 24 h and 1 h before              |             ✅             |   ✅ (24 h only)   |       —       |
| Appointment completed                      |   ✅ + review invitation   |         —          |       —       |
| Review received                            |             —              |         ✅         |       —       |
| Consultant application submitted           |             —              | ✅ acknowledgement | ✅ queue item |
| Consultant approved / rejected / suspended |             —              |         ✅         |       —       |

**Mechanics.** A `Notification` row is inserted in the same transaction as the domain change. Email is queued into `EmailOutbox` in that transaction too, then drained asynchronously by `/api/cron/drain-outbox` with capped retries and exponential backoff — so a provider outage never fails a booking. `after()` is used for fire-and-forget work that must not block the response but does not need durability.

**Content rules.** Notification payloads carry IDs and display-safe strings only. Email bodies state that an appointment exists with a named consultant at a time — they never include `clientNote`, `AppointmentNote`, or any free text the user wrote. Subject lines avoid disclosing the platform's nature more than necessary (configurable "discreet mode" sender name is a documented future option).

**Reading.** `/notifications` lists the user's own notifications with cursor pagination; the bell shows an unread count polled from `/api/notifications/unread-count` only while the tab is visible. Marking read is an optimistic action scoped to the caller's own rows.

**Scheduling.** Reminder eligibility is computed by a cron sweep (`status = CONFIRMED AND startsAt BETWEEN now+23h AND now+25h` and the 1-hour equivalent), with a per-appointment sent-marker to make the job idempotent under retries and overlapping runs.

---

## 21. Admin architecture

**Console:** `/admin` with sub-sections for users, consultants, appointments, specializations, and the audit log.

**Consultant verification** is the core workflow: a queue of `PENDING` profiles showing bio, qualifications, specializations, and submitted credential references, with Approve / Reject (reason required) / Request-changes actions. Approval sets `verificationStatus = APPROVED` and `publishedAt`, making the consultant discoverable and bookable. Rejection keeps the account usable but unlisted, with the reason shown to the consultant. Suspension (`SUSPENDED`) immediately removes the consultant from discovery, blocks new bookings, and opens a required decision about existing future appointments: cancel them with an explanatory notification, or leave them standing. Every one of these writes an `AuditLog` entry.

**User management:** list/search users by role and status; suspend (revokes all sessions immediately), reactivate, change role. Guardrails: an admin cannot modify their own account, and the system refuses to remove the last remaining active admin.

**Appointments:** read-only list with filters (status, date range, consultant, client) showing metadata only — never `clientNote` or `AppointmentNote`. Admin cancellation requires a reason and notifies both parties.

**Specializations:** create, rename, reorder, and disable. Deletion is refused while the taxonomy entry is in use (`restrict`); disabling hides it from new selections while preserving existing associations.

**Statistics** on `/admin`: total users by role, pending applications, appointments by status, bookings in the last 30 days, completion rate. Computed with indexed aggregate queries and cached for a minute — not a reporting engine.

**Admin bootstrapping:** the first admin is created by the seed script from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, and the password must be changed on first login. There is no UI path to self-promote.

---

## 22. Consultant architecture

**Onboarding:** register as `CONSULTANT` → guided profile completion (headline, bio, experience, qualifications, specializations, languages, price, session length, consultation types, timezone) → submit for review → `PENDING`. A completion meter shows what is still missing, and submission is blocked until the required fields are present.

**While `PENDING` or `REJECTED`:** the consultant can sign in, edit their profile, and resubmit. They are absent from discovery, cannot be booked, and the availability editor is read-only with an explanatory banner.

**Once `APPROVED`:** availability editing unlocks, the public profile goes live, and bookings can arrive.

**Workspace:**

- `/consultant` — today's and this week's appointments, pending requests needing confirmation, verification status, profile completeness, recent reviews.
- `/consultant/profile` — professional profile, qualifications, specializations, languages, pricing and session policy.
- `/consultant/availability` — weekly rule grid + date exceptions, with a live preview of the resulting slots in the consultant's own timezone.
- `/consultant/appointments` — upcoming / past / cancelled tabs; per-appointment actions: confirm, cancel (reason), reschedule, mark completed, mark no-show, and private notes.
- `/consultant/reviews` — received reviews, read-only.

**Data boundaries:** a consultant sees the client's `displayName` from the moment a request exists, and full contact details only for `CONFIRMED` or `COMPLETED` appointments. They never see another consultant's data, and never see platform-wide statistics.

**Suspension behaviour:** a `SUSPENDED` consultant retains sign-in to read their history and appeal, but cannot edit availability, accept bookings, or appear in discovery.

---

## 23. Client architecture

**Discovery:** `/consultants` with free-text search over headline and bio, filters (specialization, language, consultation type, price range, availability within the next N days, minimum rating), sorting (relevance, price, rating, soonest availability), and pagination. Filters live in `searchParams`, so results are shareable and the back button behaves. Each card shows name, headline, specializations, languages, experience, price, session length, rating with review count, and the next available slot.

**Public profile:** `/consultants/[slug]` — full bio, qualifications, specializations, languages, price and policy, published reviews, and an inline slot picker. Anonymous visitors see slots but are routed to sign-in on selection, returning to the same slot afterwards via a `next` parameter.

**Booking:** described in §18.3. The confirmation step states the cancellation policy in plain words before the client commits.

**Workspace:**

- `/dashboard` — next appointment with a countdown and join/location details, recent activity, a shortcut back into discovery, and a prompt to review any completed-but-unreviewed session.
- `/appointments` — upcoming / past / cancelled tabs.
- `/appointments/[id]` — consultant, both local times, type, price, status, the client's own note, and the actions permitted by the current status and policy.
- `/profile` — personal details, timezone, languages, password change, sign out everywhere, and account deletion.
- `/notifications` — the notification list.

**Safety:** a persistently reachable `/crisis-resources` page (linked from the footer, the booking confirmation, and the dashboard) stating clearly that the platform is not an emergency service and listing emergency contacts. This is a product requirement for a mental-health context, not decoration.

---

## 24. Logging strategy

**Structured JSON via `pino`.** Every line: `timestamp`, `level`, `requestId`, `route`, `event`, `durationMs`, and — only for authenticated requests — `userId` and `role`. Correlation IDs are generated in `proxy.ts` (`x-request-id`, honouring an inbound one from the platform) and propagated through headers.

**Levels.** `error` — unexpected failures and every 5xx. `warn` — authorization denials, rate-limit trips, booking conflicts, outbox retries. `info` — domain events (`appointment.created`, `consultant.approved`) with IDs only. `debug` — development only.

**Never logged:** passwords, password hashes, session tokens, reset tokens, `clientNote`, `AppointmentNote` bodies, full email addresses (log a hash or a masked form), phone numbers, emergency contacts, request bodies of auth endpoints, full `searchParams` for authenticated routes. `pino`'s redaction config enumerates these paths, and a test asserts that a serialized log of a booking payload contains no note text.

**Audit vs application logs.** Application logs are operational and ephemeral (30 days). `AuditLog` rows are a durable, queryable record of consequential administrative actions and are never written by the logger.

**Errors.** Unexpected exceptions are logged once, at the boundary that maps them to a response, with the stack, the correlation ID, and `userId` — then surfaced to the user as a generic message carrying only the digest. An error-tracking provider (Sentry or equivalent) is wired via `instrumentation.ts` in Step 21 with PII scrubbing enabled.

---

## 25. Testing architecture

**Pyramid, weighted toward the parts that can silently be wrong.**

| Layer          | Tool                                                                                         | Scope                                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit           | Vitest                                                                                       | Pure logic: slot generation (incl. DST), policy predicates (can-cancel, can-review, can-reschedule), state-machine transitions, Zod schemas, money and slug helpers, rating math, permission matrix          |
| Integration    | Vitest + a real PostgreSQL (Docker/Testcontainers, per-suite schema, transactional rollback) | Services against the database: registration, login/session lifecycle, profile updates, availability edits with conflicts, booking, cancellation, rescheduling, reviews, admin workflows, notification writes |
| Database       | Vitest + SQL assertions                                                                      | That the constraints actually exist and bite: exclusion constraints, unique indexes, checks, cascade/restrict behaviour. These tests fail if a migration drops a constraint                                  |
| API            | Vitest                                                                                       | Route Handlers: status codes, envelopes, cron secret enforcement, rate limits, validation errors                                                                                                             |
| Authentication | Integration                                                                                  | Hash verification, session creation/renewal/revocation, cookie flags, lockout, token single-use, enumeration-resistant responses                                                                             |
| Authorization  | Integration, matrix-driven                                                                   | Every (role × resource × action) cell from §10, including cross-tenant probes that must return 404                                                                                                           |
| Concurrency    | Integration                                                                                  | N parallel `createAppointment` calls on one slot ⇒ exactly one `CONFIRMED`/`PENDING` row and N−1 `SLOT_TAKEN`; parallel reschedule into the same slot; cancel racing a booking                               |
| End-to-end     | Playwright                                                                                   | Journeys below, against a seeded database, in Chromium + one mobile viewport                                                                                                                                 |

**Critical flows that must be covered before launch**

1. Client: register → verify → search → view profile → pick slot → book → see it on the dashboard.
2. Client: cancel inside and outside the policy window (different outcomes).
3. Client: reschedule to a free slot; attempt to reschedule into a taken slot.
4. Two clients race the same slot; exactly one wins and the loser sees fresh slots.
5. Consultant: register → complete profile → submit → (admin approves) → set availability → receive and confirm a booking → mark completed.
6. Admin: approve, reject, and suspend a consultant; suspension removes them from discovery and blocks booking.
7. Authorization: client hitting `/admin` and `/consultant/*`; consultant reading another consultant's appointment; a user opening another user's appointment by ID (404).
8. Availability edit blocked by an existing appointment.
9. Review: eligible client posts one; a second attempt is refused; an ineligible user is refused.
10. Session: logout revokes; suspension revokes immediately; password change revokes everywhere.
11. DST boundary: a consultant in a DST zone keeps 09:00 local availability across the transition, and an existing appointment does not move.

**Standards.** Deterministic time via an injectable clock (never `Date.now()` inside services). Factories, not fixtures, for test data. Tests assert observable behaviour, not implementation. CI runs unit + integration + database tests on every push and the E2E suite on pull requests to `main`.

---

## 26. Deployment architecture

**Topology:** a single Next.js Node.js server (Vercel, or a container on any Node 20.9+ host) plus managed PostgreSQL, an optional Redis for rate limiting, and a platform scheduler hitting `/api/cron/*`. No other services.

**Environments:** local (Docker Postgres) → preview (per-PR, isolated or branched database) → production.

**Pipeline:** `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → unit + integration tests against an ephemeral Postgres → `pnpm build` → on `main`: `prisma migrate deploy` with the privileged migration role → deploy → smoke test `/api/health`.

**Migrations** are forward-only, reviewed as code, and additive-then-destructive across two deploys for any column removal. Constraint-only migrations (the exclusion constraints, `btree_gist`) are hand-written with `prisma migrate dev --create-only` and are covered by database tests so a regenerated migration cannot silently drop them.

**Runtime configuration:** `DATABASE_URL` points at the pooled endpoint, `DIRECT_URL` at the direct one. When more than one instance runs, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is set explicitly so action closures decrypt across servers. If the app sits behind a proxy on a different host, `serverActions.allowedOrigins` is configured.

**Self-hosting notes** (from the bundled Next.js docs): Proxy runs in the Node.js runtime and is supported on Node servers and Docker; `after()` requires the platform's `waitUntil` or the Node server's built-in support; static export is not an option for this app.

**Operations:** daily automated database backups with a tested restore procedure, point-in-time recovery where the provider supports it, health checks, uptime monitoring, error tracking, and a documented secret-rotation runbook (`SESSION_SECRET`-class values, `CRON_SECRET`, `NOTES_ENCRYPTION_KEY` with key-id-based rotation).

---

## 27. Environment variables

`config/env.ts` parses these once at boot with Zod and exports a typed object; the app fails to start if a required variable is missing or malformed. `.env.example` lists every name with a comment and **no real values**.

| Variable                                                            | Required             | Scope      | Purpose                                                  |
| ------------------------------------------------------------------- | -------------------- | ---------- | -------------------------------------------------------- |
| `DATABASE_URL`                                                      | ✅                   | server     | Pooled Postgres connection string                        |
| `DIRECT_URL`                                                        | ✅ (migrations)      | server     | Direct connection for `prisma migrate`                   |
| `APP_URL`                                                           | ✅                   | server     | Canonical origin, used in emails and absolute links      |
| `SESSION_COOKIE_NAME`                                               | —                    | server     | Defaults to `session`                                    |
| `SESSION_TTL_DAYS`                                                  | —                    | server     | Defaults to 7                                            |
| `CRON_SECRET`                                                       | ✅                   | server     | Bearer secret for `/api/cron/*`                          |
| `NOTES_ENCRYPTION_KEY`                                              | ✅                   | server     | Base64 32-byte AES-256-GCM key for `AppointmentNote`     |
| `NOTES_ENCRYPTION_KEY_ID`                                           | —                    | server     | Current key id, for rotation                             |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`                                | multi-instance only  | server     | Stable Server Action closure encryption across instances |
| `RATE_LIMIT_DRIVER`                                                 | —                    | server     | `memory` (default) or `redis`                            |
| `REDIS_URL` / `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | when `redis`         | server     | Rate-limit store                                         |
| `EMAIL_PROVIDER`                                                    | —                    | server     | `none` (default), `resend`, `ses`, `smtp`                |
| `EMAIL_API_KEY` / SMTP credentials                                  | when provider ≠ none | server     | Provider credentials                                     |
| `EMAIL_FROM`                                                        | when provider ≠ none | server     | Sender identity                                          |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`                          | dev/bootstrap        | server     | First admin account                                      |
| `LOG_LEVEL`                                                         | —                    | server     | `info` default                                           |
| `SENTRY_DSN`                                                        | —                    | server     | Error tracking, if enabled                               |
| `NEXT_PUBLIC_APP_NAME`                                              | —                    | **client** | Display name only                                        |
| `NEXT_PUBLIC_SUPPORT_EMAIL`                                         | —                    | **client** | Shown on error pages                                     |

Only the two `NEXT_PUBLIC_*` entries reach the browser, and neither is a secret. Everything else is server-only and read exclusively through `config/env.ts`.

---

## 28. Scalability considerations

The realistic first-year ceiling is thousands of consultants and tens of thousands of appointments — comfortably a single application instance plus one Postgres. The design nonetheless avoids the choices that would make growth painful:

- **Stateless application.** Sessions live in the database, not in memory, so instances scale horizontally with no sticky routing. The only in-memory state is the dev rate limiter, which is swapped for Redis in production.
- **Connection pooling.** Prisma + PgBouncer (or the platform pooler) keeps connection counts bounded as instances multiply; `DIRECT_URL` keeps migrations working.
- **Query discipline.** No N+1: list views use a single query with explicit `select` and `include`. Rating aggregates are denormalized. Deep pagination switches to keyset. Every filter path has a covering index.
- **Availability cost.** Slot generation is bounded by the requested window (≤ 31 days) and reads a small number of rows. Results are cached per consultant and invalidated by tag on any booking or rule change, so a popular profile does not recompute per visitor.
- **Write contention** concentrates on one consultant's appointment rows. The exclusion constraint serializes only genuine overlaps, not the whole table.
- **Background work** is idempotent and batched, so cron can run more frequently or in parallel without duplicating notifications.
- **Cache posture.** `cacheComponents` (PPR) is off initially for predictability; enabling it later is a configuration change plus `use cache` annotations on already-isolated read functions, not a rewrite.
- **Known future pressure points, with named exits:** full-text search outgrowing Postgres GIN → a dedicated search index; the email outbox outgrowing cron → a queue worker; analytics queries competing with transactional load → a read replica; an appointments table in the tens of millions → range partitioning by month. None of these require changing the domain model.

---

## 29. Application routing

Route groups organize layouts without appearing in URLs.

```text
PUBLIC
  /                                  Landing: value proposition, how it works, entry to discovery
  /consultants                       Discovery: search, filters, sort, pagination
  /consultants/[slug]                Public consultant profile + slot picker
  /how-it-works                      Explainer
  /crisis-resources                  Emergency guidance (not an emergency service)
  /legal/privacy, /legal/terms       Policies
  /help                              FAQ / contact

AUTHENTICATION  (anonymous only; signed-in users are redirected)
  /login                             ?next= preserves the intended destination
  /register                          Role choice: client or consultant
  /forgot-password
  /reset-password/[token]
  /verify-email/[token]

CLIENT  (role CLIENT, active)
  /dashboard
  /appointments                      ?tab=upcoming|past|cancelled
  /appointments/[id]
  /appointments/[id]/reschedule
  /appointments/[id]/review          Only when COMPLETED and unreviewed
  /profile
  /notifications
  /consultants/[slug]/book           Booking confirmation (verified email required)

CONSULTANT  (role CONSULTANT, active)
  /consultant                        Dashboard
  /consultant/onboarding             Guided completion while PENDING
  /consultant/profile
  /consultant/availability
  /consultant/appointments           ?tab=upcoming|past|cancelled
  /consultant/appointments/[id]
  /consultant/reviews

ADMIN  (role ADMIN, active)
  /admin                             Statistics overview
  /admin/consultants                 ?status=pending|approved|rejected|suspended
  /admin/consultants/[id]            Verification detail + decisions
  /admin/users                       ?role=&status=&q=
  /admin/users/[id]
  /admin/appointments                ?status=&from=&to=&consultant=
  /admin/specializations
  /admin/audit-log

ROUTE HANDLERS                       See §11.1
```

**Changes from the brief, and why:** `/consultants/[id]` becomes `/consultants/[slug]` (readable, shareable, and it does not leak a database identifier). `/consultant/dashboard` collapses to `/consultant`. `/admin/specializations` and `/admin/audit-log` are added because the features exist. `/crisis-resources` is added as a safety requirement. Booking gets its own confirmation route so it is linkable and survives a refresh.

**Per-segment files:** each of `(client)`, `(consultant)`, `(admin)` has `layout.tsx` (shell + role guard), `loading.tsx` (skeleton), `error.tsx` (recoverable boundary). The root has `not-found.tsx` and `global-error.tsx`.

---

## 30. UI/UX architecture

**Intent.** Calm, professional, trustworthy, modern, accessible. Concretely: generous whitespace, restrained colour, no urgency patterns, no dark patterns, no countdown pressure, no stock-photo therapy clichés. Every destructive action is reversible or confirmed. Every state tells the user what to do next.

**Design tokens** — defined once in `app/globals.css` under Tailwind v4's `@theme`, consumed as utility classes. No hard-coded hex values in components.

```text
Colour      background / foreground / muted / border / card
            primary     desaturated teal-blue — trust without coldness
            accent      warm sand — humane, low-arousal
            success / warning / danger — danger reserved for genuinely destructive actions
            Dark mode via prefers-color-scheme, with both themes meeting AA contrast
Typography  Geist Sans (already installed); scale 12/14/16/18/20/24/30/36;
            body 16px, line-height 1.6, measure capped at ~72ch
Spacing     4px base, 8px rhythm: 4 8 12 16 24 32 48 64
Radius      sm 6 / md 10 / lg 16 — soft, not playful
Shadow      two elevations only: resting card, floating overlay
Motion      150–200ms ease-out; respects prefers-reduced-motion (transitions collapse to instant)
Focus       2px primary ring with 2px offset, visible on every interactive element
```

**Layout strategy.** One root layout (fonts, theme, toast host, skip link) and one shell per role group: public (header + footer), auth (centered card), client/consultant (header + sidebar collapsing to a bottom bar on mobile), admin (denser sidebar + data tables). Content is capped at ~1200px; forms at ~640px; reading content at ~72ch.

**Responsive strategy.** Mobile-first. Breakpoints `sm 640 / md 768 / lg 1024 / xl 1280`. The slot picker is a vertical day list on mobile and a week grid from `md` up. Admin tables become stacked cards below `md` — never a horizontally scrolling table. Touch targets ≥ 44px.

**Form strategy.** Labels always visible (no placeholder-as-label). Help text before the input, errors after it, wired with `aria-describedby`. Validation on blur and on submit, never on every keystroke. Submit buttons disable and show progress via `useFormStatus`. Server field errors map back onto the same fields. Destructive forms require explicit confirmation. Multi-step flows (consultant onboarding, booking) show progress and preserve entered data across steps.

**Loading states.** Route-level `loading.tsx` with layout-matching skeletons; `<Suspense>` around slow fragments; inline spinners only inside buttons. No full-page spinner on navigation, and no layout shift when content arrives.

**Error states.** Three tiers: field-level (inline, specific, actionable), form-level (a summary banner above the form), and page-level (`error.tsx` with a retry and a route home). Messages say what happened and what to do; they never expose internals.

**Empty states.** Every list has one, with an explanation and the next action: no consultants match these filters (offer to clear them), no upcoming appointments (offer to browse), no availability set (offer to set it), no notifications, no reviews yet. Empty is never a blank region.

**Confirmation dialogs.** Required for: cancelling an appointment (showing the policy and any consequence), rescheduling, deleting an availability rule that affects future slots, admin approve/reject/suspend (reason required), changing a role, changing timezone, deleting an account (typed confirmation). Each names the specific object and its consequence — never a bare "Are you sure?".

**Accessibility strategy.** WCAG 2.2 AA as the target. Semantic landmarks and one `h1` per page; a skip link; keyboard operability for every interaction including the slot picker (arrow keys move across days and times, Enter selects); focus trapped in dialogs and restored on close; action results announced in an `aria-live` region; form errors associated programmatically; contrast ≥ 4.5:1 for text and 3:1 for UI boundaries; `prefers-reduced-motion` honoured; never colour alone to convey status (icon + text with every badge); `lang` set on `<html>`; images given meaningful alt text or marked decorative. Verification: `eslint-plugin-jsx-a11y` in CI, axe checks inside the Playwright suite on key pages, and a manual keyboard-only pass over the booking flow before launch.

**Content tone.** Second person, present tense, plain words. "You can cancel free until 24 hours before." Not "Cancellation requests submitted outside the permitted window may be subject to review."

---

## Consistency notes

Three places in this document deliberately depart from the original brief. Each is justified here so the implementation plan and the architecture cannot drift apart:

1. **No `/api/auth/*` Route Handlers.** Authentication runs through Server Actions (§11, §12, [ADR-005](./ADR.md#adr-005--server-actions-vs-route-handlers)). The named API areas still exist as contracts — they are Server Actions rather than HTTP endpoints.
2. **Auth.js is not used.** Credentials login in Auth.js v5 forces JWT sessions, which cannot revoke a suspended user immediately ([ADR-002](./ADR.md#adr-002--authentication-approach)).
3. **Entities added beyond the brief's list:** `Session`, `VerificationToken`, `Qualification`, `Language` (+ joins), `AvailabilityException`, `AppointmentNote`, `EmailOutbox`, `AuditLog`. Each exists because a stated requirement needs it: revocable sessions, password reset, professional credentials, language filtering, day-level availability overrides, private consultant notes, reliable email, and accountable admin actions. `AvailabilityRule` replaces the brief's flat `Availability` because recurring weekly availability with date exceptions is what consultants actually manage.
