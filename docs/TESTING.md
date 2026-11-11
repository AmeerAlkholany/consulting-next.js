# Testing Strategy & Execution Guide

This document describes the testing pyramid, execution targets, and coverage gates enforced across the platform per ARCHITECTURE.md §25.

---

## 1. Testing Pyramid Structure

| Layer                 | Runner                                   | Scope & Target                                                                                                                            | Execution Frequency         |
| --------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Unit Tests**        | Vitest (`environment: node`)             | Pure domain logic: date/time maths, slot generation, password hashing, money parsing, schema validations, formatters.                     | Every test run / Pre-commit |
| **Component Tests**   | Vitest (`environment: jsdom`)            | React component rendering, empty states, accessibility tags, buttons, forms.                                                              | Every test run / Pre-commit |
| **Integration Tests** | Vitest (`fileParallelism: false`)        | Services against live PostgreSQL test database: booking concurrency, multi-tenant IDOR matrix, cron jobs, auth tokens, review moderation. | Every push / CI             |
| **End-to-End (E2E)**  | Playwright (`chromium`, `mobile-chrome`) | User journeys across the 11 critical flows in ARCHITECTURE.md §25 + WCAG 2.2 AA accessibility audits via `@axe-core/playwright`.          | PRs / CI / Pre-release      |

---

## 2. Test Execution Commands

```bash
# Run full unit and integration test suite
pnpm vitest run

# Run with test coverage collection
pnpm vitest run --coverage

# Run specific integration tests
pnpm vitest run tests/integration/concurrency-stress.test.ts

# Run Playwright accessibility and critical flow tests
pnpm exec playwright test
```

---

## 3. Coverage Thresholds

Coverage gates are configured directly in `vitest.config.ts`:

- **Target Surfaces:** `server/services/**` and `lib/**`
- **Lines:** ≥ 80%
- **Statements:** ≥ 80%
- **Functions:** ≥ 80%
- **Branches:** ≥ 70%

---

## 4. Key Testing Helpers & Fixtures

- [tests/helpers/factories.ts](file:///c:/Users/Ameer%20Al.kholany/Desktop/consulting-next.js/tests/helpers/factories.ts): Deterministic, isolated user and consultant factory methods.
- [tests/helpers/clock.ts](file:///c:/Users/Ameer%20Al.kholany/Desktop/consulting-next.js/tests/helpers/clock.ts): Injectable, shiftable clock for date-boundary and DST testing.
- [tests/helpers/auth.ts](file:///c:/Users/Ameer%20Al.kholany/Desktop/consulting-next.js/tests/helpers/auth.ts): Session and auth cookie fixtures for service-level testing.
