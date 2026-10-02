import "server-only";

import { AuthorizationError } from "@/server/errors";
import { logger } from "@/server/logger";
import { capabilities, type ActorRole } from "@/config/roles";
import type { SessionUser } from "@/server/auth/session";

/**
 * Permission evaluator (ARCHITECTURE.md §10).
 *
 * One function, single responsibility: given a resolved session and a capability
 * id, decide whether the actor may perform it. No redirects, no cookies, no
 * DB reads — the caller supplies the fully-resolved session and the capability
 * identifier, and gets back a boolean.
 *
 * Three consumers call this:
 *
 * 1. `server/authz/guards.ts` — translates into thrown errors or passes through.
 * 2. Feature services — call this independently inside Server Actions and Route
 *    Handlers to re-check authority even when a page guard already ran.
 * 3. `tests/integration/authz.matrix.test.ts` — walks the matrix and asserts
 *    every cell matches the table in ARCHITECTURE.md §10.
 */

/**
 * Evaluates whether `user` may perform the capability identified by `id`.
 *
 * Unknown ids throw `InternalError` so a missing capability is treated as a
 * defect in the matrix rather than silently granted — every capability must
 * appear in `config/roles.ts` or this function refuses it outright.
 */
export function evaluateCapability(
  user: SessionUser | null,
  capabilityId: string,
): boolean {
  if (user === null) {
    return false;
  }

  const capability = capabilities.find((c) => c.id === capabilityId);

  if (!capability) {
    // Missing matrix entries are bugs, not "denied" — surface them loudly so
    // the test suite fails rather than silently widening access.
    throw new Error(`Unknown capability: ${capabilityId}`);
  }

  const actorRole = mapUserRoleToActorRole(user.role);
  return capability.roles.includes(actorRole);
}

function mapUserRoleToActorRole(role: SessionUser["role"]): ActorRole {
  switch (role) {
    case "CLIENT":
      return "CLIENT";
    case "CONSULTANT":
      return "CONSULTANT";
    case "ADMIN":
      return "ADMIN";
    default: {
      // Exhaustiveness check: actorRoles is a literal union, so this branch is
      // unreachable at runtime. TypeScript still requires it.
      const _exhaustive: never = role;
      throw new Error(`Unhandled role: ${_exhaustive}`);
    }
  }
}

/**
 * Checks a capability and throws `AuthorizationError` when denied.
 *
 * Uses the user's role to decide whether access is granted. Extra requirements
 * (verified email, approved consultant) are checked by the caller before invoking
 * this function, because ownership depends on the row being fetched first.
 */
export function assertCapability(
  user: SessionUser | null,
  capabilityId: string,
  options: { userLabel?: string; route?: string } = {},
): void {
  const allowed = evaluateCapability(user, capabilityId);

  if (!allowed) {
    logger.warn(
      {
        userId: user?.id,
        role: user?.role,
        capability: capabilityId,
        route: options.route,
      },
      "authorization check failed",
    );
    throw new AuthorizationError("You don't have access to this.");
  }
}

/**
 * Reads the capability matrix and returns the list of ids that a given role may
 * perform. Used by the matrix test to generate cells from data alone, without
 * repeating the table from ARCHITECTURE.md §10 by hand.
 */
export function getCapabilitiesForRole(role: ActorRole): readonly string[] {
  return capabilities
    .filter((c) => c.roles.includes(role))
    .map((c) => c.id);
}

/**
 * Verifies that every capability declared in the matrix is exercised by the
 * test suite. Called once at test startup so adding a row in `config/roles.ts`
 * without a corresponding test is caught immediately.
 */
export function assertMatrixCoverage(exercisedIds: ReadonlySet<string>): void {
  const uncovered = capabilities
    .filter((c) => !exercisedIds.has(c.id))
    .map((c) => c.id);

  if (uncovered.length > 0) {
    throw new Error(
      `Authorization matrix has uncovered capabilities: ${uncovered.join(", ")}. ` +
        `Add tests for every cell in the role × capability table from ARCHITECTURE.md §10.`,
    );
  }
}
