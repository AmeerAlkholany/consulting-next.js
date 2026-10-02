import "server-only";

import { cookies } from "next/headers";
import { env } from "@/config/env";
import { sessionPolicy } from "@/config/security";
import {
  buildSessionCookie,
  sessionExpiry,
  shouldRenewSession,
  shouldUseSecureCookie,
  type SessionCookieDescriptor,
} from "@/lib/auth-policy";
import { db } from "@/db/client";
import { generateOpaqueToken, hashOpaqueToken } from "./tokens";

/**
 * Session mechanics (ARCHITECTURE.md §9).
 *
 * A session is a database row plus an opaque token in an httpOnly cookie. The
 * raw token exists in exactly two places — the browser and this module, for the
 * duration of one request — because only its SHA-256 hash is persisted. That is
 * what makes revocation immediate (§9 "Revocation"): the next request simply
 * fails to find a live row.
 *
 * The row lifecycle lives here; the *request-scoped* read that memoizes per
 * render lives in `server/auth/dal.ts`, and the domain flows that create and
 * revoke sessions live in `server/services/auth.ts`.
 *
 * Nothing in this module may be called during render: `renewSessionIfStale`
 * writes a cookie, and Next.js forbids cookie writes while rendering (§9).
 */

/** The minimal user projection a session resolves to. Never includes the hash. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: "CLIENT" | "CONSULTANT" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  emailVerifiedAt: Date | null;
  timezone: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  lastUsedAt: Date;
}

export interface ActiveSession {
  session: SessionRecord;
  user: SessionUser;
}

export interface IssuedSession {
  session: SessionRecord;
  /** Returned to the caller exactly once; only its hash is stored. */
  token: string;
  cookie: SessionCookieDescriptor;
}

export const sessionCookieName = env.SESSION_COOKIE_NAME;

export function sessionTtlDays(): number {
  return env.SESSION_TTL_DAYS ?? sessionPolicy.defaultAbsoluteTtlDays;
}

export function getUseSecureSessionCookie(): boolean {
  return shouldUseSecureCookie({ nodeEnv: env.NODE_ENV, appUrl: env.APP_URL });
}

/**
 * Issues a session row and the cookie descriptor that carries its token. The
 * caller writes the cookie: this module never assumes it is running inside a
 * mutable request context.
 */
export async function createSession(
  userId: string,
  context: { ipHash?: string; userAgent?: string | null } = {},
): Promise<IssuedSession> {
  const now = new Date();
  const token = generateOpaqueToken();
  const expiresAt = sessionExpiry(now, sessionTtlDays());

  const session = await db.session.create({
    data: {
      userId,
      tokenHash: hashOpaqueToken(token),
      expiresAt,
      lastUsedAt: now,
      ipHash: context.ipHash ?? null,
      userAgent: context.userAgent ?? null,
    },
    select: { id: true, userId: true, expiresAt: true, lastUsedAt: true },
  });

  return {
    session,
    token,
    cookie: buildSessionCookie({
      name: sessionCookieName,
      token,
      expiresAt,
      secure: getUseSecureSessionCookie(),
    }),
  };
}

const sessionUserSelection = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  timezone: true,
  deletedAt: true,
} as const;

/**
 * Resolves a raw cookie token to a live session and its user. Returns null for
 * every failure mode at once — unknown token, revoked row, expired row, deleted
 * account — because the caller's response is the same in each case: no session.
 */
export async function findActiveSession(
  rawToken: string,
  now: Date = new Date(),
): Promise<ActiveSession | null> {
  const record = await db.session.findUnique({
    where: { tokenHash: hashOpaqueToken(rawToken) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      user: { select: sessionUserSelection },
    },
  });

  if (!record || record.revokedAt !== null) {
    return null;
  }

  if (record.expiresAt.getTime() <= now.getTime()) {
    return null;
  }

  if (record.user.deletedAt !== null) {
    return null;
  }

  return {
    session: {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
      lastUsedAt: record.lastUsedAt,
    },
    user: {
      id: record.user.id,
      email: record.user.email,
      fullName: record.user.fullName,
      role: record.user.role,
      status: record.user.status,
      emailVerifiedAt: record.user.emailVerifiedAt,
      timezone: record.user.timezone,
    },
  };
}

/**
 * Sliding renewal (§9): extends the row and re-issues the cookie once
 * `lastUsedAt` is older than the threshold. Returns the cookie to write, or
 * null when the session is fresh enough to leave alone.
 */
export async function renewSessionIfStale(
  session: SessionRecord,
  now: Date = new Date(),
): Promise<SessionCookieDescriptor | null> {
  if (!shouldRenewSession(session.lastUsedAt, now)) {
    return null;
  }

  const expiresAt = sessionExpiry(now, sessionTtlDays());
  const token = generateOpaqueToken();

  // Renewal keeps the same session row, so the stored hash is replaced with the
  // hash of a freshly generated token — a renewal therefore also rotates the
  // credential, and the new token is what the cookie carries from here on.
  const updated = await db.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { tokenHash: hashOpaqueToken(token), lastUsedAt: now, expiresAt },
  });

  if (updated.count !== 1) {
    return null;
  }

  return buildSessionCookie({
    name: sessionCookieName,
    token,
    expiresAt,
    secure: getUseSecureSessionCookie(),
  });
}

/** Revokes one session. Idempotent: an already-revoked row is left as it is. */
export async function revokeSession(sessionId: string, now: Date = new Date()): Promise<number> {
  const result = await db.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now },
  });

  return result.count;
}

export async function revokeSessionByToken(
  rawToken: string,
  now: Date = new Date(),
): Promise<number> {
  const result = await db.session.updateMany({
    where: { tokenHash: hashOpaqueToken(rawToken), revokedAt: null },
    data: { revokedAt: now },
  });

  return result.count;
}

/**
 * Sign out everywhere: password change, suspension, and the explicit action
 * (§9, BR-12).
 */
export async function revokeAllSessions(userId: string, now: Date = new Date()): Promise<number> {
  const result = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });

  return result.count;
}

/**
 * Deletes rows that can no longer authenticate anyone — expired or revoked.
 * The scheduled prune (§16 retention) calls this; it never deletes a live
 * session.
 */
export async function deleteDeadSessions(now: Date = new Date()): Promise<number> {
  const result = await db.session.deleteMany({
    where: { OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] },
  });

  return result.count;
}

/** Writes the outgoing session cookie. Server Actions and Route Handlers only. */
export async function writeSessionCookie(cookie: SessionCookieDescriptor): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(cookie.name, cookie.value, cookie.options);
}

/** Clears the session cookie. Server Actions and Route Handlers only. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

/** Reads the raw session token from the incoming request, if any. */
export async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(sessionCookieName)?.value ?? null;
}

