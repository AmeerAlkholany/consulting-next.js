# Architecture Decision Records

Decisions taken while designing the psychological consultation booking platform. Each record states the decision, the context that forced it, the options weighed, what was chosen, why, and what the choice costs.

**Status:** all records are _Accepted (planning)_. None has been implemented — see [IMPLEMENTATION.md](./IMPLEMENTATION.md) for the execution order and [ARCHITECTURE.md](./ARCHITECTURE.md) for the design these decisions produce.

| #                                                                           | Decision                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| [ADR-001](#adr-001--database-engine-and-access-layer)                       | Database engine and access layer                       |
| [ADR-002](#adr-002--authentication-approach)                                | Authentication approach                                |
| [ADR-003](#adr-003--application-architecture-pattern)                       | Application architecture pattern                       |
| [ADR-004](#adr-004--server-components-by-default)                           | Server Components by default                           |
| [ADR-005](#adr-005--server-actions-vs-route-handlers)                       | Server Actions vs Route Handlers                       |
| [ADR-006](#adr-006--state-management)                                       | State management                                       |
| [ADR-007](#adr-007--validation-strategy)                                    | Validation strategy                                    |
| [ADR-008](#adr-008--booking-concurrency-control)                            | Booking concurrency control                            |
| [ADR-009](#adr-009--timezone-handling)                                      | Timezone handling                                      |
| [ADR-010](#adr-010--availability-representation)                            | Availability representation                            |
| [ADR-011](#adr-011--authorization-failure-surfaces)                         | Authorization failure surfaces                         |
| [ADR-012](#adr-012--caching-posture)                                        | Caching posture                                        |
| [ADR-013](#adr-013--styling-and-component-library)                          | Styling and component library                          |
| [ADR-014](#adr-014--rate-limiting)                                          | Rate limiting                                          |
| [ADR-015](#adr-015--money-representation)                                   | Money representation                                   |
| [ADR-016](#adr-016--identifier-strategy)                                    | Identifier strategy                                    |
| [ADR-017](#adr-017--testing-stack-and-pyramid)                              | Testing stack and pyramid                              |
| [ADR-018](#adr-018--storage-of-sensitive-session-notes)                     | Storage of sensitive session notes                     |
| [ADR-019](#adr-019--email-delivery-through-a-transactional-outbox)          | Email delivery through a transactional outbox          |
| [ADR-020](#adr-020--profile-edits-after-approval-and-role-change-semantics) | Profile edits after approval and role change semantics |

---

## ADR-001 — Database engine and access layer

**Decision.** PostgreSQL 16 as the database, Prisma as the ORM and migration tool, with hand-written SQL in migrations where Prisma's schema language is not expressive enough.

**Context.** The domain is relational and heavily constrained: appointments reference two profiles, availability derives from rules and exceptions, ratings aggregate reviews. The hardest correctness requirement in the whole system — never double-book — is a temporal overlap constraint. The project already uses TypeScript in strict mode, so type-safe query construction matters.

**Options considered.**

1. _PostgreSQL + Prisma._ Mature migrations, strong TypeScript inference, a large ecosystem. Loses some SQL expressiveness at the schema level.
2. _PostgreSQL + Drizzle._ Closer to SQL, lighter runtime, the schema is TypeScript. Migration tooling is younger and the relational query builder is less settled.
3. _MySQL or PlanetScale + Prisma._ Good scaling story and branch-based schema changes. No range types, no exclusion constraints, no `tstzrange` — the overlap rule would have to move into application code.
4. _MongoDB + Mongoose._ Flexible documents. Multi-entity transactions are possible but awkward, and referential integrity would become the application's job.
5. _Raw SQL with a thin client._ Maximum control, maximum hand-written maintenance and no generated types.

**Selected approach.** Option 1. Prisma owns the schema and the generated client. Two migration types exist: Prisma-generated ones for models and indexes, and hand-edited ones for `btree_gist`, exclusion constraints, CHECK constraints, partial indexes, and the GIN full-text index. `$queryRawUnsafe` is banned by lint; parameterized `$queryRaw` is allowed where genuinely needed.

**Reason.** PostgreSQL exclusion constraints let the database — not the application — guarantee that two overlapping active appointments cannot exist for one consultant. That single capability is decisive: every application-level check-then-insert scheme has a race window, and this domain's worst failure mode is two clients arriving for the same hour. Options 3 and 4 give that guarantee up. Between Prisma and Drizzle, Prisma's migration workflow and its ability to accept hand-edited SQL migrations matter more here than Drizzle's SQL fidelity, because the hand-written parts are few and stable.

**Trade-offs.**

- Prisma's client is heavier at runtime than Drizzle's and adds cold-start weight on serverless platforms.
- Constraints defined in hand-edited migrations are invisible to the Prisma schema, so they must be documented in ARCHITECTURE.md §8 and pinned by database tests, otherwise a future developer can forget they exist.
- `btree_gist` must be installable on the target host; managed providers that forbid extensions rule this design out, which is why Step 3 stops and reports rather than falling back silently.
- Prisma's connection handling needs a pooler (PgBouncer or the platform's equivalent) under serverless concurrency.

---

## ADR-002 — Authentication approach

**Decision.** Custom credentials authentication with database-backed opaque sessions: Argon2id password hashing, a 32-byte random session token stored as its SHA-256 hash, delivered in an `httpOnly` cookie.

**Context.** Admins must be able to suspend a user and have that take effect immediately — a suspended consultant must not be able to accept a booking one minute later. The product needs email and password sign-in now; third-party identity providers are not a requirement. The platform handles sensitive health-adjacent data, so session revocation is a security control, not a convenience.

**Options considered.**

1. _Auth.js (NextAuth) v5 with the Credentials provider._ Wide adoption, batteries included. But the Credentials provider **forces JWT sessions** — the database session strategy is unavailable with it. A JWT stays valid until it expires, so suspension would not take effect until the token aged out. Its compatibility with Next.js 16.3.5 is also not verified in this repository.
2. _A hosted identity provider (Clerk, Auth0, WorkOS)._ Fast to integrate, professional security posture, MFA and device management included. Adds a vendor, a per-user cost, and an external dependency holding user identity for a sensitive product. Roles and profiles still have to be mirrored locally.
3. _Lucia._ A good fit conceptually, but the library was deprecated as a maintained package and repositioned as a learning resource, so adopting it means adopting unmaintained code.
4. _Custom credentials with database sessions._ Full control, immediate revocation, no vendor. All the security responsibility is ours.

**Selected approach.** Option 4. The session cookie carries an opaque random token; the `Session` row holds only its SHA-256 hash, plus `userId`, `expiresAt`, `lastUsedAt`, and coarse device metadata. Lookups happen in a React `cache()`-memoized `getSession()` inside the Data Access Layer. Expiry is 7 days absolute with sliding renewal after 24 hours of use. Revocation deletes rows: on logout, on password change, on suspension, and on role change.

**Reason.** Immediate revocation is a product requirement (BR-12), and only a server-side session store provides it. Option 1 cannot deliver it with credentials at all. Option 2 could, but introduces a third party into the identity path for a mental-health product where data minimization is a stated principle, and still would not remove the need for local role and profile records. The custom path is a well-trodden one: the primitives are hashing, random tokens, and a cookie, all of which are standard and testable.

**Trade-offs.**

- We own the security-critical code — hashing parameters, timing-safe comparison, lockout, token entropy. Mitigated by pinning Argon2id parameters in `config/security.ts` and by the auth test suite in Step 4.
- Every authenticated request costs a session lookup. Mitigated by `cache()` memoization within a request and by an index on the token hash; this is one indexed point lookup, not a scan.
- No MFA, passkeys, or social sign-in on day one. The `User` table is designed so these can be added later without migrating identity.
- The `proxy.ts` layer cannot validate sessions (no database access on that path), so it is explicitly optimistic UX only — see ARCHITECTURE.md §10.

---

## ADR-003 — Application architecture pattern

**Decision.** A modular monolith inside a single Next.js application, organized by feature, with a strict layering rule: `app → features → server/services → server/dal → db`.

**Context.** One team, one product, three roles, and a domain whose parts are tightly coupled — booking reads consultants, availability, and appointments in one transaction. The brief explicitly warns against unnecessary architectural complexity.

**Options considered.**

1. _Single Next.js application, modular monolith._ One deployment, one transaction boundary, straightforward local development.
2. _Next.js frontend plus a separate backend service (NestJS, Fastify)._ Clear boundaries, independently scalable, reusable by a future mobile client. Doubles the deployment surface, adds a network hop and a serialization layer, and duplicates authentication.
3. _Microservices per domain (users, booking, notifications)._ Independent scaling and failure isolation. Distributed transactions for something a single `BEGIN`/`COMMIT` handles today.
4. _A monolith organized by technical layer (all controllers together, all services together)._ Familiar, but every feature change touches four distant directories.

**Selected approach.** Option 1. `features/<domain>/` holds UI and actions for one slice; `server/services/<domain>.ts` holds its business rules; `server/dal/` holds authorization-aware data access. Layering is enforced by ESLint import rules: a component may not import the Prisma client, and the DAL may not import React components.

**Reason.** The booking transaction is the core of the product and it spans consultants, availability, and appointments. Splitting those across services would convert a database transaction into a distributed saga for no benefit at this scale. Feature-oriented modules keep related code together, and the layering rule preserves the one property a split would have bought — a clear dependency direction — without the operational cost. If a mobile client or an independent scaling need appears later, `server/services/` is already the seam to extract.

**Trade-offs.**

- Everything scales together; a heavy admin report competes with booking traffic for the same instances.
- Module boundaries are conventions backed by lint rules, not process boundaries, so they can be violated by someone determined to.
- A non-web consumer would need an API layer built on top of the services, which does not exist yet.
- Build and test times grow with the whole application rather than per service.

---

## ADR-004 — Server Components by default

**Decision.** Every component is a Server Component unless it needs interactivity. `'use client'` is pushed to the leaves: forms, dialogs, pickers, and anything using state, effects, or browser APIs.

**Context.** Next.js 16 App Router makes Server Components the default. The product's heaviest pages — discovery, dashboards, appointment lists — are read-mostly and data-dense. Users may be on modest devices and constrained networks.

**Options considered.**

1. _Server Components by default, client islands at the leaves._
2. _Client Components by default with Server Components only for static shells._ Familiar to a React SPA team, but ships the data-fetching layer and the query client to the browser.
3. _Static generation with client-side fetching._ Fast first paint on public pages, but personalized and permission-filtered data would all arrive over the wire after hydration, with loading flashes and a larger attack surface.

**Selected approach.** Option 1. Data fetching lives in Server Components calling the DAL directly. Client Components receive plain serializable props — DTOs, never Prisma model instances. Interactive pieces are small and isolated: `slot-picker`, `filter-panel`, `booking-confirmation`, the dialogs, and the forms.

**Reason.** Keeping data access on the server means authorization filtering happens where it cannot be bypassed, and means private fields need never be serialized to the browser at all. For a platform where a leaked field is a privacy incident, "the data never leaves the server unless a DTO says so" is a security property, not just a performance one. The bundle reduction is a genuine secondary benefit on the read-heavy pages.

**Trade-offs.**

- The server/client boundary is a real cognitive cost: a misplaced `'use client'` can drag a subtree into the bundle, and an accidental import of a server module from a client file is a build error that needs understanding to fix.
- Every prop crossing the boundary must be serializable, which forces explicit DTO mapping — more code, but it is the same code that protects against over-exposure.
- Interactivity that spans islands needs care; URL state (ADR-006) is the answer rather than a shared client store.

---

## ADR-005 — Server Actions vs Route Handlers

**Decision.** Server Actions are the default for all mutations initiated by the application's own UI. Route Handlers exist only for machine consumers and for browser-initiated GETs that are not page navigations.

**Context.** Next.js 16 offers both. Almost every mutation in this product originates from a form in this application: book, cancel, reschedule, approve, update profile. A few surfaces are different in kind: a slot picker fetching a new date range, a typeahead, an unread-count poll, cron endpoints, and a health check.

**Options considered.**

1. _Server Actions for mutations, Route Handlers for machine and polling reads._
2. _Route Handlers for everything, called with `fetch` from Client Components._ Uniform and familiar; costs a hand-written client, manual serialization, and manual CSRF handling on every mutation.
3. _Server Actions for everything, including the polling and cron surfaces._ Actions are POST-only and carry framework-specific identifiers, which makes them a poor fit for a scheduler or a cacheable GET.
4. _tRPC._ Excellent end-to-end types, but it duplicates what Server Actions already provide in this framework and adds a second RPC concept to the codebase.

**Selected approach.** Option 1. Eight Route Handlers exist in total: health, consultant availability, consultant search typeahead, notification unread count, and four cron jobs. Everything else is a Server Action following the fixed six-step anatomy in ARCHITECTURE.md §12 — rate limit, parse, authenticate, authorize, execute in a transaction, invalidate and return.

**Reason.** Server Actions remove an entire layer of hand-written plumbing for the 90 % case, and progressive enhancement means a form still works before hydration. Route Handlers remain the right tool where the caller is not this application's UI — a cron scheduler cannot invoke a Server Action, and a cacheable GET is not expressible as one.

**Trade-offs.**

- **A Server Action is a public POST endpoint.** It can be invoked directly with a crafted request, so it must re-verify authentication and authorization itself and never trust the page that rendered it. This is stated as a rule in ARCHITECTURE.md §12 and re-audited in Step 19.
- Actions are harder to exercise with `curl` or Postman than REST endpoints; integration tests call the service layer directly, which is where the rules live anyway.
- Multi-instance deployments must set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` or action identifiers will not validate across instances.
- No public API for third parties. That is acceptable and, for a product handling this data, arguably correct for now.

---

## ADR-006 — State management

**Decision.** No global client state library. State lives in one of four places: the server (the source of truth), the URL (filters, tabs, pagination), React Hook Form (form state), and local `useState` (ephemeral UI).

**Context.** The classic reason for Redux or Zustand — a client-side cache of server data shared across components — largely disappears when Server Components fetch data per request. What remains is filter state, form state, and dialog open/closed.

**Options considered.**

1. _No global store; server, URL, form, local._
2. _Zustand or Jotai._ Small and pleasant, but creates a second source of truth for data the server already owns, with the invalidation problems that follow.
3. _TanStack Query._ Strong for client-fetched data, largely redundant when Server Components fetch and `revalidateTag` invalidates.
4. _Redux Toolkit._ Heavy for this shape of application; the boilerplate would exceed the state being managed.

**Selected approach.** Option 1. Discovery filters, appointment tabs, and pagination cursors are `searchParams`. Forms use React Hook Form with a Zod resolver. Toasts and dialogs are local. Cross-cutting server data refreshes through `revalidateTag`/`updateTag` after actions, not through a client cache.

**Reason.** Putting filters in the URL makes results shareable and bookmarkable, makes the back button behave, and is one fewer thing to synchronize. Avoiding a client cache avoids the hardest bug class in this kind of application — stale data that disagrees with the server about whether a slot is still free. In a booking product, a stale client cache is not a cosmetic problem.

**Trade-offs.**

- Some interactions cost a server round-trip where a client store would have been instant. Mitigated with `useOptimistic` for the few cases where latency is perceptible (marking notifications read, toggling accepting-bookings).
- URL state has practical length limits and needs careful parsing; `consultantSearchSchema` handles malformed input with `.catch()` defaults rather than errors.
- Should a genuinely cross-cutting client concern appear later (a real-time presence indicator, say), a small store can be introduced for that concern alone rather than retrofitted globally.

---

## ADR-007 — Validation strategy

**Decision.** Zod schemas in `schemas/`, shared between client forms and server actions, with the server-side parse always authoritative. Validation happens at four layers: form, action, service invariants, and database constraints.

**Context.** Inputs arrive from forms, URLs, route parameters, and cron callers. TypeScript types vanish at runtime, so the boundary between "typed" and "actually checked" has to be explicit and enforced.

**Options considered.**

1. _Zod, shared schemas._ Excellent TypeScript inference, mature, composable.
2. _Valibot._ Smaller bundles through modularity, but a smaller ecosystem and weaker integration with the form library.
3. _Yup._ Long-established, weaker inference, less idiomatic in a strict TypeScript codebase.
4. _Hand-written type guards._ No dependency; far more code and far more places to forget a check.
5. _Database constraints only._ Correct but user-hostile — errors arrive as constraint violations with no field attribution.

**Selected approach.** Option 1. One schema per input shape, imported by both the form's resolver and the action. The action's `safeParse` is authoritative and runs even though the form already validated, because the action is a public endpoint (ADR-005). Business invariants that a schema cannot express — is this slot actually available, is this transition legal — are checked in the service inside the transaction. Constraints in the database are the final, non-bypassable layer.

**Reason.** Sharing schemas keeps client and server rules from drifting, which is the usual source of "the form let me submit it but the server refused". Four layers sounds redundant but each catches something the others cannot: the form gives immediate feedback, the action stops crafted requests, the service enforces temporal and state rules, and the database enforces what must never be violated regardless of code path — including by a migration script or a console session.

**Trade-offs.**

- Zod adds to the client bundle where schemas are shared. Acceptable; the schemas are small and tree-shaking helps.
- The same rule can appear at more than one layer (for instance, price positivity in both `consultantProfileSchema` and a CHECK constraint), so a change must be made in both. This is intentional defence in depth, and the database test suite pins the constraint half.
- Zod error shapes need mapping to field-level UI errors; `Result<T>` carries a `fieldErrors` map to standardize that.

---

## ADR-008 — Booking concurrency control

**Decision.** Prevent double-booking with PostgreSQL exclusion constraints over `tstzrange`, filtered to active statuses, on both the consultant and the client. Application checks exist for good error messages, not for correctness.

**Context.** Two clients can click the same slot in the same second. Next.js can run many instances, so in-process locking is worthless. This is the single most damaging failure the product can have: two people show up for one appointment.

**Options considered.**

1. _Check availability, then insert._ Simple, and wrong — there is always a window between the check and the insert.
2. _`SELECT ... FOR UPDATE` on the consultant row._ Correct, but serializes every booking for a consultant and holds a row lock for the whole transaction, including any slow work inside it.
3. _`SERIALIZABLE` isolation._ Correct, but pushes serialization failures onto every transaction in the system and requires retry logic everywhere.
4. _A unique index on `(consultantProfileId, startsAt)` filtered to active statuses._ Cheap and available on any PostgreSQL. Prevents identical start times but **not** genuine overlaps — a 60-minute appointment at 09:00 and a 30-minute one at 09:30 would both be accepted.
5. _An exclusion constraint on `(consultantProfileId, tstzrange(startsAt, endsAt))` with `&&`, filtered to `PENDING`/`CONFIRMED`._ The database rejects any overlap, whatever the durations.
6. _A distributed lock in Redis._ Adds a dependency in the correctness path and has its own failure modes; a lock lost to a network partition is a double booking.

**Selected approach.** Option 5, twice: one constraint keyed on `consultantProfileId` and a second on `clientProfileId`, so a client also cannot be in two places at once. Both are `WHERE status IN ('PENDING','CONFIRMED')`, so cancelled appointments free their time immediately. The application still recomputes availability inside the transaction to produce precise errors; SQLSTATE `23P01` maps to `SLOT_TAKEN` (consultant key) or `CLIENT_DOUBLE_BOOKED` (client key). Status changes are compare-and-set.

**Reason.** Only the database can see all concurrent transactions, so only the database can arbitrate. An exclusion constraint expresses the actual rule — no overlapping intervals — rather than a proxy for it, so variable session durations, buffers, and rescheduling are all covered by one invariant. It fails fast, it costs no lock contention on the read path, and it cannot be bypassed by a future code path that forgets to check.

**Trade-offs.**

- Requires the `btree_gist` extension. Hosts that forbid extensions cannot run this design; Step 3 stops and reports rather than degrading silently, because Option 4 is a strictly weaker guarantee and swapping it in quietly would leave a false sense of safety.
- The error arrives as a driver-level constraint violation that must be mapped carefully — the two constraints are distinguished by name, so the mapping must read the constraint name, not just the SQLSTATE.
- GiST index maintenance costs slightly more on write than a B-tree. Irrelevant at this write volume.
- Cancelled and completed appointments are outside the constraint's predicate, so historical overlap is possible by design (an appointment cancelled and another booked in its place). That is correct behaviour, but it means history alone cannot be used to assert "no overlaps ever existed".

---

## ADR-009 — Timezone handling

**Decision.** Store every instant in UTC as `timestamptz`. Store each participant's IANA timezone. Store availability rules as wall-clock times in the consultant's zone. Convert only at the edges, and always display the zone.

**Context.** Consultants and clients can be anywhere. A consultant who works 09:00–17:00 local expects to keep working 09:00–17:00 after a DST transition, not to shift by an hour. A client booking from another country must see the time in their own zone without ambiguity.

**Options considered.**

1. _Store everything in UTC; convert for display._ Standard, but insufficient on its own: storing a recurring rule as a UTC offset breaks at every DST transition.
2. _Store local times plus an offset._ Offsets are not zones; the same offset means different things in different years, and historical data becomes unreliable.
3. _Store UTC instants for appointments, and store availability rules as (weekday, minutes from local midnight, IANA zone)._ Wall-clock rules stay stable across transitions; concrete appointments are unambiguous instants.
4. _Store everything in the consultant's local time._ Comparing across consultants and computing "upcoming" globally becomes a mess.

**Selected approach.** Option 3, with `date-fns` v4 and `@date-fns/tz` for conversions. Appointments store `startsAt`/`endsAt` as `timestamptz` plus snapshots of `consultantTimezone` and `clientTimezone` at booking time. DST rules are explicit: a slot that falls in a spring-forward gap is dropped; a slot in a fall-back ambiguity resolves to the first occurrence. Every rendered time names its zone, and when the two participants' zones differ, both are shown.

**Reason.** Splitting the representation by what each thing _is_ — a rule is a wall-clock intention, an appointment is a fixed instant — resolves the conflict that makes timezone code go wrong. Snapshotting both zones means a past appointment can always be re-rendered exactly as it was presented, even if a participant later moves.

**Trade-offs.**

- Two representations means two sets of conversion code and a bigger test surface; the slot generator's test matrix in Step 11 exists mainly for this.
- Dropping gap slots means a consultant loses one hour of availability once a year, silently. The preview in the availability editor shows the real generated slots, so it is visible rather than hidden.
- Resolving fall-back ambiguity to the first occurrence is a choice, not a law; the second occurrence is simply never offered. Documented so nobody treats it as a bug.
- The IANA database changes; the deployment must carry a current `tzdata`, and stale zone data on an old runtime can shift computed slots.

---

## ADR-010 — Availability representation

**Decision.** Store availability as rules and exceptions, and generate concrete slots on demand with a pure function. Do not materialize slot rows in the database.

**Context.** A consultant's availability is naturally recurring ("Tuesdays and Thursdays, 09:00 to 17:00") with occasional deviations ("away on the 14th", "extra hours this Saturday"). Clients need concrete bookable instants.

**Options considered.**

1. _Materialize a `Slot` row for every bookable instant, some horizon ahead._ Querying is trivial. But a single rule change rewrites thousands of rows, a background job must keep the horizon extended, and `Slot` and `Appointment` can disagree about reality.
2. _Store rules and exceptions; generate slots on read._ The database stays small, edits are instant, and there is exactly one source of truth. Generation costs CPU on every read.
3. _Generate on read with a cache keyed by consultant and date range, invalidated on change._ Option 2 plus amortization.
4. _Store an RRULE string per rule._ Expressive and standard, but heavy to parse, hard to edit through a grid UI, and most of its power is unused here.

**Selected approach.** Option 3. `AvailabilityRule` holds `(weekday, startMinute, endMinute, effectiveFrom, effectiveUntil)` interpreted in the consultant's zone; `AvailabilityException` blocks or adds time on a specific date. The generator is a pure function of rules, exceptions, existing appointments, and policy (duration, buffer, lead time, maximum advance) — no I/O, fully unit-testable. Results are cached per consultant and range under the tag `availability:{consultantId}`, invalidated by any rule, exception, or appointment change.

**Reason.** The database should hold the intention, not its expansion. Keeping slots derived means they cannot drift from the rules that produced them, and a rule edit takes effect immediately for everyone. Making the generator pure is what makes the DST matrix in Step 11 testable at all — no database, no clock, no fixtures, just inputs and expected instants.

**Trade-offs.**

- "Which consultants have availability soonest?" cannot be answered by a simple indexed query, because there is nothing indexed to sort by. The discovery sort therefore computes over a bounded candidate set, which is why it is deferred from Step 10 to Step 11 and why its p95 target is called out in Step 22.
- Slot generation is CPU work on a read path; the 150 ms p95 target for a 14-day range is a real budget that Step 22 must verify.
- Cache invalidation must be complete: a missed tag means a client sees a slot that is already booked, discovers it at submit time, and gets `SLOT_TAKEN`. Unpleasant but not incorrect — the database still refuses the overlap (ADR-008).

---

## ADR-011 — Authorization failure surfaces

**Decision.** A request for a resource the caller does not own returns **404, not 403**. Wrong-role access to a route the caller knows exists returns 403. Unauthenticated access redirects to login. Ownership is expressed as a `where` clause, never as fetch-then-compare.

**Context.** Appointment ids, profile ids, and review ids can be guessed or enumerated. On a psychological consultation platform, confirming that a given appointment id exists is itself a disclosure — it tells an attacker that some client has a session with some consultant.

**Options considered.**

1. _403 Forbidden on any ownership failure._ Honest in the HTTP sense, and it confirms the resource exists.
2. _404 for ownership failures; 403 only for role failures._ Reveals nothing about the existence of other users' data.
3. _404 for everything, including role failures._ Maximally opaque, but it makes legitimate role mistakes confusing — a client following a stale link to an admin page deserves to be told they lack permission, not that the page is missing.

**Selected approach.** Option 2. Every resource-by-id query carries the ownership predicate in its `where` clause, so a non-owned row is simply not returned and the handler calls `notFound()` on the empty result. Role failures, where the route's existence is not secret, render the 403 page.

**Reason.** Fetch-then-compare is the standard IDOR bug: the row is loaded, and then somebody forgets the comparison, or logs the loaded object, or returns part of it in an error message. Putting ownership in the query makes the safe path the only path — there is no loaded object to leak. Returning 404 then follows naturally, since the query genuinely found nothing.

**Trade-offs.**

- Debugging is harder: "404" covers both "this id does not exist" and "it exists but is not yours". Server-side logs record which case occurred, at `warn` level with the actor and the resource type, so operators can tell them apart even though users cannot.
- Slightly more verbose queries, since the ownership predicate is repeated. The DAL centralizes the common ones so the repetition is one function, not one per call site.
- The IDOR matrix test in Step 19 must cover every owned resource against every non-owner role, which is a large but mechanical suite.

---

## ADR-012 — Caching posture

**Decision.** Leave `cacheComponents` off. Cache only public, non-personalized reads, with explicit tags. Never cache anything scoped to a user. Use `updateTag` inside Server Actions for read-your-own-writes and `revalidateTag(tag, 'max')` elsewhere.

**Context.** Next.js 16 offers several caching layers, and the single-argument `revalidateTag(tag)` form is deprecated in favour of an explicit profile argument. Most of this application's data is personalized and permission-filtered: dashboards, appointment lists, notifications. A caching mistake here is not a stale page, it is one user seeing another user's data.

**Options considered.**

1. _Opt into `cacheComponents` and cache aggressively._ Best performance, and the largest blast radius if a personalized fragment is cached by mistake.
2. _No caching at all._ Safest, and it leaves obvious wins on the table for genuinely public pages like discovery and public profiles.
3. _Cache only public reads, with explicit tags, and leave the experimental component-level caching off._

**Selected approach.** Option 3. Cached: consultant search results, public consultant profiles, the taxonomy, and generated availability — all tagged (`consultants:list`, `consultant:{slug}`, `availability:{consultantId}`, `taxonomy`). Never cached: anything behind a role guard. Mutations invalidate their tags; a Server Action that must show its own write immediately uses `updateTag`, which is Server-Actions-only.

**Reason.** The cost of a cache mistake is asymmetric. A missing cache costs milliseconds; a wrongly-shared cache entry on this platform is a privacy incident. Restricting caching to data that is public by definition means there is no category of entry that _could_ leak — the question "is this user-specific?" never has to be asked at runtime, because user-specific data is never cached at all. `cacheComponents` stays off until the product is stable and the team has time to reason about it properly.

**Trade-offs.**

- Dashboards and appointment lists hit the database on every request. Acceptable at this scale, and Step 22 addresses it with query shape and indexes rather than caching.
- Tag discipline is manual: a forgotten `updateTag` after a booking shows a stale slot list until the next natural revalidation. Mitigated by centralizing invalidation inside the services rather than scattering it across actions.
- Declining `cacheComponents` means forgoing a genuine performance feature; revisit once the flag stabilizes and the security review has bandwidth.

---

## ADR-013 — Styling and component library

**Decision.** Tailwind CSS v4 with CSS-first `@theme` tokens, plus shadcn/ui components copied into the repository over Radix primitives. No component framework dependency.

**Context.** Tailwind v4 is already installed via `@tailwindcss/postcss`. The interface must feel calm, professional, and trustworthy, and must meet WCAG 2.2 AA. The application needs accessible dialogs, selects, popovers, and tabs — all components that are easy to get subtly wrong.

**Options considered.**

1. _Tailwind + shadcn/ui (Radix under the hood, source in the repo)._ Accessible primitives, full control over markup and tokens, no runtime framework.
2. _MUI or Mantine._ Comprehensive and quick to start; a large runtime, an opinionated visual language to fight, and theming that works against Tailwind.
3. _Tailwind plus hand-written components._ Maximum control and maximum risk — focus trapping, `aria` wiring, and keyboard behaviour in dialogs and comboboxes are exactly the things hand-rolled components get wrong.
4. _Headless UI._ Good primitives, a narrower component set than Radix.

**Selected approach.** Option 1. Design tokens live in `@theme` in `app/globals.css` so both Tailwind utilities and raw CSS read the same values. shadcn/ui components are vendored into `components/ui/` and owned by the project. A calm palette, generous spacing, restrained motion, and `prefers-reduced-motion` support are defined at the token level.

**Reason.** Accessibility is a functional requirement for this product, and Radix's primitives encode behaviour that would otherwise have to be rebuilt and retested. Vendoring the components rather than depending on a library means visual changes are local edits, not theme overrides fighting a framework's defaults. Tailwind v4 is already present, so this adds no new styling paradigm.

**Trade-offs.**

- Vendored components do not update automatically; upstream fixes must be pulled in deliberately.
- More initial setup than importing a finished component library.
- Tailwind's utility-heavy markup is verbose; `lib/cn.ts` and `class-variance-authority` keep variants organized rather than sprawling.
- The team owns visual consistency, which is why the token layer and the primitive set land together in Step 2 rather than growing per feature.

---

## ADR-014 — Rate limiting

**Decision.** A small `server/rate-limit.ts` interface with two drivers: in-memory for development and single-instance deployments, Redis for production. Per-surface budgets, applied first in every Server Action and Route Handler.

**Context.** Login, registration, and password reset are credential-attack surfaces. Booking is an abuse surface — a script could hold every slot a consultant has. The public search and availability endpoints are scraping surfaces. Server Actions are publicly invocable POST endpoints (ADR-005), so "it is only called from our form" is not a control.

**Options considered.**

1. _No rate limiting._ Not defensible for a product with credentials and a public booking surface.
2. _In-memory counters only._ Zero dependencies, and useless the moment there is more than one instance — an attacker's requests spread across instances, each seeing a fraction of the traffic.
3. _Redis (Upstash or equivalent) with a sliding window._ Correct across instances, adds a dependency.
4. _Database-backed counters in a `RateLimitCounter` table._ No new infrastructure, but it puts write load on the primary database on the hot path of every request.
5. _Platform or WAF-level rate limiting only._ Useful as a coarse outer layer, but it cannot express per-user or per-action budgets.

**Selected approach.** Option 3 behind the interface from Option 2, with Option 4 available as a documented fallback for deployments without Redis. Budgets are defined per surface in ARCHITECTURE.md §16 — strictest on login, registration, and password reset; moderate on booking and other mutations; loose on public reads. Keys combine the actor (user id when authenticated, IP when not) with the surface name. A trip returns 429 with `Retry-After` and a friendly message.

**Reason.** The interface split matters more than the driver: features call `rateLimit(key, budget)` and never learn which driver is behind it, so development stays dependency-free while production gets a correct distributed counter. Combining user id and IP in the key keeps a shared-NAT office from locking each other out while still bounding a single authenticated abuser.

**Trade-offs.**

- Redis is a new production dependency and a possible failure point. The driver fails **open** for reads and **closed** for authentication surfaces, so a Redis outage degrades protection on public pages rather than locking everyone out of the product — a deliberate asymmetry, documented so it is not mistaken for a bug.
- The in-memory driver gives a false sense of protection if it ever reaches production on multiple instances; `config/env.ts` warns loudly when `NODE_ENV=production` and no Redis URL is set.
- IP-based limits are weak against distributed attacks and imprecise behind proxies; the proxy header configuration must be correct or the limiter keys on the wrong address.

---

## ADR-015 — Money representation

**Decision.** Store money as an integer number of minor units (`sessionPriceMinor`) with a separate ISO 4217 currency code. Never use floating point. Format for display only at the edge.

**Context.** Consultants set a session price, and it is snapshotted onto each appointment so that a later price change does not rewrite history.

**Options considered.**

1. _Integer minor units plus a currency code._
2. _`DECIMAL(10,2)` in the database mapped to a JavaScript number._ Precise in the database, but the mapping passes through a float in JavaScript and reintroduces the problem it was meant to solve.
3. _Floating point throughout._ Wrong for money, in the standard well-known way.
4. _A dedicated money library with `BigInt` or arbitrary precision._ Correct and heavier than this product needs while there is no multi-currency arithmetic.

**Selected approach.** Option 1, with a small `lib/money.ts` for arithmetic and `Intl.NumberFormat` for display, and a CHECK constraint enforcing a positive price.

**Reason.** Integers are exact, they serialize cleanly across the server/client boundary, and they compare and sort correctly in the database. Keeping the currency in its own column leaves room for consultants in different currencies without an implicit assumption baked into the price column.

**Trade-offs.**

- Every read must format and every write must parse, so a raw value shown by mistake reads as `12000` rather than `120.00`. The formatter lives in one module and is unit-tested.
- Currencies with zero or three minor units (JPY, KWD) need the exponent respected rather than a hard-coded division by 100; `lib/money.ts` takes the currency into account.
- No currency conversion, and none is planned — the price is charged and displayed in the currency the consultant set.

---

## ADR-016 — Identifier strategy

**Decision.** Opaque, non-sequential primary keys generated by the application (`cuid2`, or UUIDv7 where ordered keys help). Human-facing consultant URLs use a separate stable `slug`. Appointment URLs use the opaque id.

**Context.** Ids appear in URLs and in payloads. Sequential integers leak volume ("appointment 4127") and invite enumeration, which matters more than usual when the mere existence of a record is sensitive (ADR-011).

**Options considered.**

1. _Auto-increment integers._ Compact and index-friendly; enumerable and volume-leaking.
2. _UUIDv4._ Unguessable, but random keys fragment B-tree indexes on insert.
3. _`cuid2` or UUIDv7._ Unguessable in practice and roughly time-ordered, so index locality is preserved.
4. _Sequential internal ids plus a separate public token per row._ Best of both, at the cost of a second column and a second lookup path on every resource.

**Selected approach.** Option 3 for primary keys. Consultants additionally carry a `slug` derived from the name, unique and stable after publication, used in public URLs (`/consultants/[slug]`). Appointments and other private resources are addressed by their opaque id.

**Reason.** Guessable ids plus 404-on-non-ownership still leak through timing and through the sheer fact that ids are dense: an attacker who can enumerate ids learns how many appointments exist. Opaque ids remove the enumeration primitive entirely. Slugs give consultants a shareable, readable, SEO-friendly URL, which appointments do not need.

**Trade-offs.**

- Wider keys than integers: more index bytes and more storage. Negligible at this scale.
- Ids are not human-friendly in support conversations; the admin console provides search rather than asking anyone to read an id aloud.
- Slugs need collision handling at creation and immutability afterwards — renaming a consultant does not change their slug, which is stated in Step 8 so nobody "fixes" it later.

---

## ADR-017 — Testing stack and pyramid

**Decision.** Vitest for unit and integration tests, Playwright for end-to-end, tests running against a real PostgreSQL instance rather than mocks, with an injectable clock everywhere time matters.

**Context.** The riskiest logic in this product is slot generation, booking concurrency, and authorization. None of those can be verified by mocking the database: the exclusion constraint _is_ the concurrency guarantee, so a test that mocks it tests nothing.

**Options considered.**

1. _Vitest + Playwright + a real database._
2. _Jest + Cypress._ Both are mature; Jest needs more configuration for an ESM and TypeScript codebase, and Cypress is weaker at multi-tab and multi-session scenarios than Playwright.
3. _A mocked Prisma client for speed._ Fast, and it would have declared the booking concurrency test passing while the real system double-booked.
4. _An in-memory SQLite substitute._ Fast and portable, and it lacks `tstzrange`, exclusion constraints, and the full-text search this design depends on — a substitute that cannot express the invariants under test.

**Selected approach.** Option 1. Unit tests cover pure logic, above all the slot generator. Integration tests exercise services against a real database with per-suite isolation. Playwright covers the eleven critical flows in ARCHITECTURE.md §25. Coverage thresholds apply to `server/services/**` and `lib/**` — the code where a bug is a business incident — rather than to UI files, and a bare `Date.now()` inside a service is treated as a test failure because it makes time-dependent behaviour unverifiable.

**Reason.** The tests that matter most here are precisely the ones mocks cannot write: ten concurrent bookings resolving to one winner, a DST transition preserving a consultant's 09:00, a cancelled appointment freeing its slot. Those need the real engine. Thresholding services rather than components puts the pressure where correctness lives instead of inflating a number with shallow render tests.

**Trade-offs.**

- CI needs a PostgreSQL service and is slower than a mocked suite; the pipeline splits fast unit tests from slower integration and E2E layers so feedback stays quick.
- Database tests need careful isolation or they interfere; `tests/helpers/db.ts` owns that and every suite uses it.
- E2E tests are the most brittle layer; role and label selectors are preferred over test ids, which has the side effect of pushing accessibility improvements into the markup.

---

## ADR-018 — Storage of sensitive session notes

**Decision.** Encrypt `AppointmentNote.body` at the application layer with AES-256-GCM, a per-row IV, and a stored key id for rotation. Notes are readable only by their author. Admins have no read path.

**Context.** A consultant's private notes about a session are the most sensitive data the platform holds. Database-level encryption at rest protects against a stolen disk; it does not protect against a leaked read-only connection string, an over-broad query, or a support engineer browsing a table.

**Options considered.**

1. _Plaintext with access control only._ Simple, and every accidental exposure — a log line, a wide `SELECT *`, a database export — is a disclosure of clinical content.
2. _Transparent database or disk encryption only._ Protects the storage medium; the data is plaintext to anyone with a connection.
3. _Application-layer AES-256-GCM with a key held outside the database._
4. _Per-consultant keys derived from a password._ Strongest confidentiality, and it makes the data unrecoverable when a consultant forgets their password — unacceptable for records a consultant may be obliged to retain.

**Selected approach.** Option 3. The key comes from `NOTES_ENCRYPTION_KEY` in the environment, never the database; `NOTES_ENCRYPTION_KEY_ID` is stored with each ciphertext so keys can be rotated without a flag day. GCM provides authenticated encryption, so tampering is detected rather than silently decrypted. The DAL structurally excludes note bodies from every admin projection (BR-11).

**Reason.** Separating the key from the data means a database compromise alone does not yield clinical content. Authenticated encryption additionally means a modified ciphertext fails loudly. This is defence in depth on top of authorization, not a replacement for it — the access rules still apply first.

**Trade-offs.**

- Encrypted columns cannot be searched or indexed. Accepted: notes are read one appointment at a time, and searching across clients' clinical notes is not a feature anyone should want.
- Key management becomes an operational responsibility — the key must be present for the application to function, and losing it loses the notes permanently. `docs/SECRETS.md` and the backup drill in Step 23 cover this.
- A small CPU cost per read and write, and decryption failures need a graceful surface rather than a stack trace.
- This is a security control, not a compliance claim. The platform does **not** claim HIPAA, GDPR, or any other regulatory compliance; ARCHITECTURE.md §17 lists what would additionally be required before any such claim could be made.

---

## ADR-019 — Email delivery through a transactional outbox

**Decision.** Write email intents to an `EmailOutbox` table inside the same transaction as the domain change, and deliver them from a separate scheduled job.

**Context.** Booking confirmations, verification links, password resets, and reminders all need email. Sending inline inside a request means either a slow request or a lost email when delivery fails, and a provider call inside a database transaction can leave the two inconsistent in both directions.

**Options considered.**

1. _Send inline during the request._ Simplest, and it couples the user's latency to the provider's, with no retry and a real chance of "the booking succeeded but the email did not" — or worse, an email sent for a transaction that then rolled back.
2. _Send after the response using `after()`._ Removes the latency, but still no durable retry: a crash between response and send loses the message silently.
3. _A transactional outbox row written in the transaction, drained by a job._ Delivery becomes a durable, retryable, observable queue with no new infrastructure.
4. _A dedicated queue (BullMQ, SQS)._ More capable, and more infrastructure than the volume justifies.

**Selected approach.** Option 3. Every notification-producing action writes both a `Notification` row and an `EmailOutbox` row inside its transaction. A cron endpoint drains the outbox in bounded batches with exponential backoff and a maximum attempt count, marking rows `SENT` or `FAILED`.

**Reason.** The outbox makes the invariant exact: an email exists if and only if the domain change committed. A rolled-back booking cannot send a confirmation, and a committed booking's confirmation survives a crash because it is a row, not a pending promise. Retries and failures become inspectable rows rather than lost log lines.

**Trade-offs.**

- Delivery latency equals the drain interval rather than being immediate; for verification and reset emails the interval must be short enough to feel instant, which constrains the schedule.
- The outbox table grows and needs pruning, which the prune job handles.
- Provider-side failures (a bounce, a suppression) still need handling beyond "the API call succeeded"; that is out of scope for the first version and noted as such.
- Email content is deliberately minimal — never any free text a user wrote (ARCHITECTURE.md §20) — so notification emails tell the recipient to sign in rather than reproducing details in the message.

---

## ADR-020 — Profile edits after approval and role change semantics

**Decision.** An approved consultant may edit their profile without re-entering the verification queue. A role change keeps the previously-created profile rather than deleting it, and the consultant profile becomes unpublished.

**Context.** Two questions with no obviously right answer, both of which would otherwise be resolved inconsistently at implementation time. If every edit required re-approval, consultants could not fix a typo without going offline. If a role change deleted the old profile, appointment history would lose its counterpart.

**Options considered.**

For profile edits after approval:

1. _Any edit returns the profile to `PENDING`._ Safest for content control, and hostile to consultants: correcting a phone number would unpublish them.
2. _Edits never affect approval._ Frictionless, and it allows the reviewed content to be replaced entirely after approval.
3. _Material edits (biography, qualifications) trigger re-review; cosmetic ones do not._ The best behaviour, and it requires a field-level classification and a review queue for edits that does not exist yet.

For role change: 4. _Delete the old profile._ Clean, and it breaks appointment history and destroys a consultant's reviews. 5. _Keep the old profile, unpublished._ Reversible and history-preserving, at the cost of rows that are not currently in use.

**Selected approach.** Option 2 for edits in the first version, with Option 3 recorded as the intended successor once an edit-review queue exists. Option 5 for role changes: a client becoming a consultant keeps the client profile, a consultant becoming a client keeps the consultant profile with `publishedAt` cleared and `isAcceptingBookings` false, and the change rotates the user's session.

**Reason.** Option 2 is the honest choice while there is no edit-review mechanism — pretending to do material-edit review without a queue to handle it would be worse than not doing it. The audit log records profile changes, so abuse is detectable after the fact, and an admin can suspend. Keeping profiles on a role change preserves the foreign keys that appointments and reviews depend on, and makes the change reversible without data loss.

**Trade-offs.**

- An approved consultant can replace their reviewed biography with unreviewed content, detectable but not prevented. Mitigated by the audit trail and by admin suspension, and slated for Option 3 later.
- Orphaned profile rows accumulate for users who switch roles. Harmless, but queries must filter on role rather than on the existence of a profile — a subtle trap worth stating explicitly.
- Rotating the session on a role change signs the user out of other devices, which is mildly disruptive and is the correct security behaviour when permissions change.
