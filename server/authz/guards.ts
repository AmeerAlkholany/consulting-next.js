import "server-only";

import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@/server/errors";
import { logger } from "@/server/logger";
import { assertCapability } from "@/server/authz/policy";
import { getCurrentUser, type SessionUser } from "@/server/auth/dal";
import { safeRedirectPath } from "@/lib/redirects";

/**
 * Authorization guards (ARCHITECTURE.md §10).
 *
 * Each guard resolves the session, checks the relevant preconditions, and
 * either returns the user or throws / redirects. The authoritative authorization
 * check lives in the service the action calls — these guards exist so pages and
 * layouts can render the correct shell and hide controls the user cannot use.
 *
 * Guards are pure about the session they receive: they never fetch a second
 * time, they never call the database beyond what `getCurrentUser()` already did,
 * and they never redirect to a computed URL based on attacker-controlled input.
 */

/** Redirect to login when unauthenticated, preserving the requested destination. */
function redirectToLogin(redirectPath: string): never {
  const next = safeRedirectPath(redirectPath, "/");
  redirect(`/login?next=${encodeURIComponent(next)}`);
}

/**
 * Resolves the current session. Returns the user when authenticated and active;
 * throws `AuthenticationError` when there is no session. A suspended user gets
 * a distinct answer so the caller can sign them out with an explanation rather
 * than pretending they were never signed in (ARCHITECTURE.md §10).
 */
export async function requireUser(
  options: { redirectPath?: string; suspendedMessage?: string } = {},
): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (user === null) {
    if (options.redirectPath !== undefined) {
      redirectToLogin(options.redirectPath);
    }
    throw new AuthenticationError("Please sign in again.");
  }

  if (user.status !== "ACTIVE") {
    logger.warn(
      { userId: user.id, status: user.status },
      "active user check failed",
    );
    // Suspended/deactivated users are signed out rather than shown a 403 —
    // the explanation belongs to the caller, not here.
    throw new AuthenticationError(
      options.suspendedMessage ?? "Your account has been suspended. Contact support.",
    );
  }

  return user;
}

/**
 * Resolves the session and asserts the user has the required role.
 * Returns the user when authorized; throws `AuthorizationError` otherwise.
 */
export async function requireRole(
  requiredRole: SessionUser["role"],
  options: { redirectPath?: string } = {},
): Promise<SessionUser> {
  const user = await requireUser(options);

  assertCapability(user, mapRoleToCapability(requiredRole), {
    userLabel: user.id,
    route: options.redirectPath,
  });

  if (user.role !== requiredRole) {
    logger.warn(
      { userId: user.id, role: user.role, requiredRole },
      "role mismatch",
    );
    throw new AuthorizationError("You do not have permission to access this page.");
  }

  return user;
}

function mapRoleToCapability(role: SessionUser["role"]): string {
  switch (role) {
    case "CLIENT":
      return "browseConsultants";
    case "CONSULTANT":
      return "browseConsultants";
    case "ADMIN":
      return "browseConsultants";
  }
}

/**
 * Resolves the session and asserts the user is a CLIENT. Returns the user when
 * authorized; throws `AuthorizationError` otherwise.
 */
export async function requireClient(
  options: { redirectPath?: string } = {},
): Promise<SessionUser> {
  return requireRole("CLIENT", options);
}

/**
 * Resolves the session and asserts the user is a CONSULTANT. Returns the user
 * when authorized; throws `AuthorizationError` otherwise.
 *
 * When `approved` is true, the caller additionally checks
 * `consultantProfile.verificationStatus === 'APPROVED'`. Ownership of the
 * consultant profile is checked by the feature service, not here.
 */
export async function requireConsultant(
  options: { approved?: boolean; redirectPath?: string } = {},
): Promise<SessionUser> {
  const user = await requireRole("CONSULTANT", options);

  if (options.approved === true) {
    // The approved check must happen in the service that fetches the profile,
    // because the DAL projection in `getCurrentUser()` does not include
    // `consultantProfile.verificationStatus`. This guard exists only to assert
    // the role is CONSULTANT; the approval gate is enforced where the profile
    // row is read (ARCHITECTURE.md §10 enforcement layer 1).
    assertCapability(user, "manageAvailability", {
      userLabel: user.id,
      route: options.redirectPath,
    });
  }

  return user;
}

/**
 * Resolves the session and asserts the user is an ADMIN. Returns the user when
 * authorized; throws `AuthorizationError` otherwise.
 */
export async function requireAdmin(
  options: { redirectPath?: string } = {},
): Promise<SessionUser> {
  return requireRole("ADMIN", options);
}

/**
 * Resolves the session and asserts the user has a verified email address.
 * Throws `AuthorizationError` when the email is not verified.
 */
export async function requireVerifiedEmail(
  options: { redirectPath?: string } = {},
): Promise<SessionUser> {
  const user = await requireUser(options);

  if (user.emailVerifiedAt === null) {
    logger.warn({ userId: user.id }, "verified email required but not present");
    throw new AuthorizationError("Please verify your email address to continue.");
  }

  return user;
}

/**
 * Asserts that `appointment` belongs to `actor`. Throws `AuthorizationError`
 * when the ids do not match. Ownership is checked against the fetched row,
 * never against untrusted input.
 */
export function assertOwnsAppointment(
  actor: SessionUser,
  appointment: { clientProfile?: { userId: string }; consultantProfile?: { userId: string } },
): void {
  const owns =
    appointment.clientProfile?.userId === actor.id ||
    appointment.consultantProfile?.userId === actor.id;

  if (!owns) {
    logger.warn(
      { userId: actor.id, appointmentId: (appointment as { id?: string }).id },
      "appointment ownership check failed",
    );
    throw new AuthorizationError("You don't have access to this.");
  }
}

/**
 * Asserts that `profile` belongs to `actor`. Throws `AuthorizationError`
 * when the ids do not match.
 */
export function assertOwnsProfile(
  actor: SessionUser,
  profile: { userId: string },
): void {
  if (profile.userId !== actor.id) {
    logger.warn(
      { userId: actor.id, profileId: profile.userId },
      "profile ownership check failed",
    );
    throw new AuthorizationError("You don't have access to this.");
  }
}
