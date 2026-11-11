# Security Policy and Architecture Implementation

This document describes the concrete security architecture, threat model mitigations, and compliance postures implemented across this platform in realization of [ARCHITECTURE.md](../ARCHITECTURE.md) §16 and §17.

---

## 1. Authentication Security

- **Hashing Algorithm:** Argon2id with pinned OWASP baseline profile parameters:
  - Memory cost: `19_456 KiB` (19 MiB)
  - Time cost: `2` iterations
  - Parallelism: `1` lane
  - Output length: `32` bytes
  - Implementation: Native `@node-rs/argon2`
- **Password Policy:**
  - Minimum length: 12 characters; Maximum length: 128 characters.
  - Must satisfy at least 3 of 4 character classes: lowercase, uppercase, numbers, symbols.
  - Checked against common credential-stuffing wordlists (`commonPasswordDenyList`).
- **Lockout Policy:**
  - 10 consecutive failures lock the account for 15 minutes.
  - Constant-work authentication paths prevent username enumeration or timing attacks.
- **Single Sign-Out & Session Revocation:**
  - Password reset or user suspension terminates all active sessions immediately (`revocationToken` and DB delete).

---

## 2. Session and Cookie Hardening

- **Mechanics:**
  - Cookie flags: `HttpOnly`, `Secure` (in production/HTTPS), `SameSite=Lax`, `Path=/`.
  - Tokens: 256-bit cryptographically secure pseudorandom numbers (`crypto.randomBytes(32)`).
  - Stored hashed at rest: `tokenHash = sha256(rawToken)`. A database compromise never reveals raw session tokens.
  - Absolute lifespan: 7 days (`SESSION_TTL_DAYS`).
  - Idle renewal: Sliding window update after 24 hours of inactivity.
  - No JWTs in readable cookies or client `localStorage`.

---

## 3. Authorization & IDOR Defenses

- **Independent Action Verification:**
  - Every Server Action independently resolves `getCurrentUser()`. No mutation relies solely on page middleware or client guards.
- **Owner-Filtered Queries:**
  - All reads and mutations of tenant data enforce ownership in the database query `where` clause (e.g. `where: { id: appointmentId, clientProfileId: clientProfile.id }`).
  - Missing records or unauthorized attempts return **404 Not Found**, never 403 Forbidden, preventing attackers from probing for valid IDs.
- **Role Tampering Prevention:**
  - Role and status are read solely from the database user record, never accepted from user input or request parameters.

---

## 4. Rate Limiting Matrix

Implemented behind the unified `RateLimiter` interface supporting both local in-memory storage and production Redis (`ioredis`):

| Surface                                          | Budget       | Keying                               |
| :----------------------------------------------- | :----------- | :----------------------------------- |
| `loginAction`                                    | 5 / 15 min   | IP + Email                           |
| `loginAction`                                    | 20 / 15 min  | IP                                   |
| `registerAction`                                 | 5 / hour     | IP                                   |
| `requestPasswordResetAction`                     | 3 / hour     | Email                                |
| `requestPasswordResetAction`                     | 10 / hour    | IP                                   |
| `createAppointmentAction`                        | 10 / hour    | User ID                              |
| `createReviewAction`                             | 5 / day      | User ID                              |
| `/api/consultants/search`, `/api/*/availability` | 60 / min     | IP                                   |
| `/api/notifications/unread-count`                | 120 / min    | Session ID                           |
| `/api/cron/*`                                    | Secret-gated | `Authorization: Bearer $CRON_SECRET` |

---

## 5. Content Security Policy & Security Headers

- **Strict CSP with Dynamic Nonce:**
  - Per-request cryptographic nonce generated in `proxy.ts`.
  - Directive:
    ```text
    default-src 'self';
    script-src 'self' 'nonce-<base64>' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self';
    connect-src 'self';
    frame-ancestors 'none';
    form-action 'self';
    base-uri 'self';
    object-src 'none';
    ```
- **Transport and Clickjacking Headers:**
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
  - `X-Frame-Options: DENY`
  - `X-Robots-Tag: noindex, nofollow` on all authenticated routes.

---

## 6. Clinical Privacy & Data Protection (BR-11, ARCHITECTURE.md §17)

- **Clinical Notes Isolation:**
  - `AppointmentNote.body` is encrypted at rest using AES-256-GCM application envelope encryption with key versioning (`NOTES_ENCRYPTION_KEY`, `NOTES_ENCRYPTION_KEY_ID`).
  - Admins see appointment metadata (timestamps, price, status) but **never** `clientNote` or `AppointmentNote` content.
- **Anonymous Public Attribution:**
  - Reviews are publicly attributed only to first name + last initial (e.g. "Jane D.").
  - User accounts, emails, and identifiers are never exposed publicly.
- **Logging Redaction:**
  - Pino logger strictly censors credentials, tokens, clinical free-text, phone numbers, and emergency contacts under `[REDACTED]`.

---

## 7. Static Analysis & Linter Guardrails

- `dangerouslySetInnerHTML`: Banned via ESLint AST rule `no-restricted-syntax`.
- `$queryRawUnsafe`: Banned via ESLint AST rule. All SQL must use tagged templates (`$queryRaw`) in `server/dal/**`.
- `process.env`: Direct access banned project-wide, restricted exclusively to `config/env.ts`.
