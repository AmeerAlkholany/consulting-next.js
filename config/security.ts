/**
 * Security policy — the single place the platform's pinned security parameters
 * live (ARCHITECTURE.md §9, §16).
 *
 * Deliberately free of `node:*` imports and of `@/config/env`: the password
 * policy and the strength rules are also read by client-side forms, so this
 * module must stay importable from a browser bundle. Values that come from the
 * environment (the session cookie name and the session TTL) are applied where
 * they are used — `server/auth/session.ts` — never here.
 */

/**
 * Password policy (ARCHITECTURE.md §9 step 1: "≥ 12 characters with a
 * character-class rule", checked against a small common-password deny-list).
 * A password must satisfy the length bound and at least
 * `requiredCharacterClasses` of `classes`.
 */
export const passwordPolicy = {
  minLength: 12,
  maxLength: 128,
  requiredCharacterClasses: 3,
  classes: [
    { id: "lowercase", label: "a lowercase letter", pattern: /[a-z]/ },
    { id: "uppercase", label: "an uppercase letter", pattern: /[A-Z]/ },
    { id: "number", label: "a number", pattern: /[0-9]/ },
    { id: "symbol", label: "a symbol", pattern: /[^A-Za-z0-9]/ },
  ],
} as const;

/**
 * A small deny-list rather than a dictionary attack surface: the entries are
 * the passwords that survive the length and class rules above yet appear in
 * every credential-stuffing wordlist. Comparison is case-insensitive.
 */
export const commonPasswordDenyList: readonly string[] = [
  "password1234",
  "password12345",
  "password123456",
  "qwertyuiop123",
  "qwerty123456",
  "letmein12345",
  "iloveyou1234",
  "welcome12345",
  "changeme1234",
  "administrator",
  "admin1234567",
  "superman1234",
  "trustno12345",
  "football1234",
  "baseball1234",
  "sunshine12345",
  "princess12345",
  "monkey123456",
  "dragon123456",
  "consulting12",
  "psychology12",
];

/**
 * Argon2id parameters (ARCHITECTURE.md §9, §16). These are the OWASP baseline
 * profile — 19 MiB of memory, two passes, single lane — not an invented cost.
 * Changing them changes every stored hash's verification cost, so they are
 * versioned here and nowhere else.
 */
export const argon2idParameters = {
  memoryCostKiB: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLengthBytes: 32,
} as const;

/**
 * Session mechanics (ARCHITECTURE.md §9 "Session mechanics"). The absolute
 * lifetime is expressed in days here and resolved against `SESSION_TTL_DAYS`
 * by the session module; sliding renewal happens once a session has been idle
 * for longer than `renewalThresholdMs`.
 */
export const sessionPolicy = {
  defaultAbsoluteTtlDays: 7,
  renewalThresholdMs: 24 * 60 * 60 * 1000,
  tokenBytes: 32,
  /** `Session.userAgent` is `VarChar(200)`. */
  userAgentMaxLength: 200,
  cookie: {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  },
} as const;

/** Login throttling (ARCHITECTURE.md §9 "Login" step 3, §16). */
export const loginLockoutPolicy = {
  maxFailedAttempts: 10,
  lockDurationMs: 15 * 60 * 1000,
} as const;

/**
 * Single-use, hashed, TTL-bounded tokens (ARCHITECTURE.md §9 registration step
 * 5 and "Password reset").
 */
export const verificationTokenPolicy = {
  tokenBytes: 32,
  emailVerificationTtlMs: 24 * 60 * 60 * 1000,
  passwordResetTtlMs: 60 * 60 * 1000,
} as const;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Rate-limit budgets for the auth surfaces, taken from the ARCHITECTURE.md §16
 * table. They are consumed through `server/rate-limit.ts`, whose interface is
 * what lets the store move from per-process memory to Redis without touching a
 * call site.
 */
export const authRateLimits = {
  loginPerIpAndEmail: { points: 5, durationMs: 15 * MINUTE },
  loginPerIp: { points: 20, durationMs: 15 * MINUTE },
  registerPerIp: { points: 5, durationMs: HOUR },
  passwordResetPerEmail: { points: 3, durationMs: HOUR },
  passwordResetPerIp: { points: 10, durationMs: HOUR },
  /**
   * Not in the §16 table: the resend-verification surface does not exist there
   * yet, and without a budget it is an email-bombing endpoint. Same shape as
   * the password-reset budget, keyed per user.
   */
  resendVerificationPerUser: { points: 3, durationMs: HOUR },
  /** Public discovery typeahead search. */
  discoverySearch: { points: 30, durationMs: MINUTE },
} as const;
