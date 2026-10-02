import { loginLockoutPolicy, sessionPolicy } from "@/config/security";

/**
 * Pure authentication arithmetic (ARCHITECTURE.md §9, §16).
 *
 * Session expiry, sliding renewal, the login lockout window, and the session
 * cookie's attributes are all decisions about *numbers and flags*, not about
 * databases or requests. Keeping them here — framework-free, importable from
 * anywhere — is what lets them be unit-tested directly and keeps
 * `server/auth/session.ts` to the part that genuinely needs a request and a
 * connection.
 */

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  expires: Date;
}

export interface SessionCookieDescriptor {
  name: string;
  value: string;
  options: SessionCookieOptions;
}

/** Absolute expiry: `ttlDays` from `now` (§9: a 7-day absolute lifetime). */
export function sessionExpiry(now: Date, ttlDays: number): Date {
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}

export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Sliding renewal (§9): a session is extended once it has been in use for
 * longer than the threshold, so an active user is never signed out mid-task
 * while an abandoned session still expires.
 */
export function shouldRenewSession(
  lastUsedAt: Date,
  now: Date = new Date(),
  thresholdMs: number = sessionPolicy.renewalThresholdMs,
): boolean {
  return now.getTime() - lastUsedAt.getTime() >= thresholdMs;
}

/** `http://localhost:3000`, `https://localhost:8443`, `http://127.0.0.1` … */
export function isLocalhostOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

/**
 * `secure` is unconditional in production and permitted to be false only for a
 * plain-http local development origin (§9).
 */
export function shouldUseSecureCookie(options: { nodeEnv: string; appUrl: string }): boolean {
  if (options.nodeEnv === "production") {
    return true;
  }
  return !isLocalhostOrigin(options.appUrl);
}

export function buildSessionCookie(options: {
  name: string;
  token: string;
  expiresAt: Date;
  secure: boolean;
}): SessionCookieDescriptor {
  return {
    name: options.name,
    value: options.token,
    options: {
      httpOnly: sessionPolicy.cookie.httpOnly,
      secure: options.secure,
      sameSite: sessionPolicy.cookie.sameSite,
      path: sessionPolicy.cookie.path,
      expires: options.expiresAt,
    },
  };
}

export interface LockoutState {
  /** False once the lock window has elapsed, even though the row still holds the count. */
  isLocked: boolean;
  lockedUntil: Date | null;
  /** The count a *fresh* window should start from when the lock has lifted. */
  failedLoginCount: number;
  remainingMs: number;
}

/**
 * Reads the lock state as of `now`. Ordinary failures accumulate; a lock that
 * has *elapsed* is a fresh window, so the counter resets and one stale failure
 * cannot immediately re-lock a user who has already served the wait.
 */
export function evaluateLockout(
  state: { failedLoginCount: number; lockedUntil: Date | null },
  now: Date = new Date(),
): LockoutState {
  const locked = state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();

  if (locked) {
    return {
      isLocked: true,
      lockedUntil: state.lockedUntil,
      failedLoginCount: state.failedLoginCount,
      remainingMs: state.lockedUntil!.getTime() - now.getTime(),
    };
  }

  return {
    isLocked: false,
    lockedUntil: null,
    failedLoginCount: state.lockedUntil === null ? state.failedLoginCount : 0,
    remainingMs: 0,
  };
}

/**
 * Applies one failure (§9: "after 10 failures set `lockedUntil = now + 15
 * min`").
 */
export function registerFailedLogin(
  previous: { failedLoginCount: number; lockedUntil: Date | null },
  now: Date = new Date(),
): { failedLoginCount: number; lockedUntil: Date | null } {
  const current = evaluateLockout(previous, now);
  const failedLoginCount = current.failedLoginCount + 1;

  if (failedLoginCount >= loginLockoutPolicy.maxFailedAttempts) {
    return {
      failedLoginCount,
      lockedUntil: new Date(now.getTime() + loginLockoutPolicy.lockDurationMs),
    };
  }

  return { failedLoginCount, lockedUntil: null };
}
