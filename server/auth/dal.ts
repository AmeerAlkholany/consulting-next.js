import "server-only";

import { cache } from "react";
import {
  findActiveSession,
  readSessionToken,
  type ActiveSession,
  type SessionUser,
} from "./session";

/**
 * The Data Access Layer for authentication (ARCHITECTURE.md §9 "Reading the
 * session (the DAL)").
 *
 * `cache()` from React memoizes within a single render pass, so a page whose
 * header, banner, and body each ask who is signed in performs exactly one
 * database read. That matters because the session lookup is a join on the hot
 * path of every request.
 *
 * These functions are read-only by construction: they never write a cookie, so
 * they are safe to call while rendering. Sliding renewal deliberately lives in
 * `server/services/auth.ts` (`touchSession`), which is only called from Server
 * Actions, because Next.js forbids cookie writes during render.
 *
 * `requireUser` and the role guards arrive with the rest of the authorization
 * layer in Step 5; they build on `getCurrentUser` rather than duplicating the
 * lookup.
 */

/**
 * The current request's session, or null. A revoked, expired, unknown, or
 * deleted-account session all resolve to null: the caller's answer is the same
 * in every one of those cases.
 */
export const getSession = cache(async (): Promise<ActiveSession | null> => {
  const token = await readSessionToken();

  if (!token) {
    return null;
  }

  return findActiveSession(token);
});

/**
 * The signed-in user, or null. The projection is deliberately minimal — id,
 * email, name, role, status, verification state, timezone — and never contains
 * the password hash or any profile content.
 *
 * `status` is returned even when it is `SUSPENDED` rather than being filtered
 * here, so the authorization layer can sign the caller out *with an
 * explanation* instead of failing as if they were never signed in (§10).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  return session?.user ?? null;
});

/** A signed-in user whose account is not suspended or deactivated. */
export function isUserActive(user: SessionUser | null): boolean {
  return user !== null && user.status === "ACTIVE";
}

export type { ActiveSession, SessionUser };
