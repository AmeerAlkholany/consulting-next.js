/**
 * The permission matrix, as data (ARCHITECTURE.md §10).
 *
 * This module is the single source of truth for what a role may do. Three
 * consumers read it, and they must never disagree:
 *
 *   1. `server/authz/policy.ts` — the evaluator the guards and services call.
 *   2. `tests/integration/authz.matrix.test.ts` — which walks every
 *      capability × role cell in this file, so a capability added here without
 *      a decision is a failing test rather than a silent hole.
 *   3. `proxy.ts` — which needs the protected route prefixes without touching
 *      the database.
 *
 * It is deliberately free of `server-only`, `next/*`, and Zod: `config/` is a
 * leaf layer that anything may import (ARCHITECTURE.md §4), and `proxy.ts` runs
 * outside the application runtime.
 */

export const userRoles = ["CLIENT", "CONSULTANT", "ADMIN"] as const;
export type UserRole = (typeof userRoles)[number];

/** `VISITOR` is not a `UserRole`: it is the absence of one. See §10's table. */
export const actorRoles = ["VISITOR", "CLIENT", "CONSULTANT", "ADMIN"] as const;
export type ActorRole = (typeof actorRoles)[number];

export const accountStatuses = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
export type AccountStatus = (typeof accountStatuses)[number];

export const consultantVerificationStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;
export type ConsultantVerificationStatus = (typeof consultantVerificationStatuses)[number];

/**
 * Extra conditions a capability places on an actor beyond their role. Ownership
 * (`own` vs `any`) cannot be decided from a role alone — it needs the row — so
 * it is recorded here as a declaration and enforced by `assertOwns*` in
 * `server/authz/guards.ts` and by the ownership-filtered `where` clause in the
 * service that performs the read or write.
 */
export interface CapabilityRequirements {
  /** The account must have `emailVerifiedAt` set (§9 registration step 6). */
  verifiedEmail?: boolean;
  /** The consultant profile must be `APPROVED` (BR-2). */
  approvedConsultant?: boolean;
  /** The row must belong to the actor. Enforced against the fetched row. */
  ownership?: "own" | "any";
  /** The action writes an `AuditLog` row (BR-13). */
  audited?: boolean;
  /** The capability returns metadata only, never free text (BR-11). */
  metadataOnly?: boolean;
}

export interface CapabilityDefinition {
  /** Stable identifier used in code, logs, and the matrix test. */
  id: string;
  /** The matrix's row label, phrased as the capability in §10. */
  description: string;
  /** Roles for which the cell is ✅. An empty array means "nobody". */
  roles: readonly ActorRole[];
  requirements?: CapabilityRequirements;
}

const everyone: readonly ActorRole[] = ["VISITOR", "CLIENT", "CONSULTANT", "ADMIN"];
const client: readonly ActorRole[] = ["CLIENT"];
const consultant: readonly ActorRole[] = ["CONSULTANT"];
const admin: readonly ActorRole[] = ["ADMIN"];
const clientAndConsultant: readonly ActorRole[] = ["CLIENT", "CONSULTANT"];

/**
 * The full permission matrix from ARCHITECTURE.md §10.
 *
 * Every row must appear here. The matrix test generates cells for every
 * combination, so omitting a row silently hides a hole in the coverage suite.
 */
export const capabilities: readonly CapabilityDefinition[] = [
  {
    id: "browseConsultants",
    description: "Browse approved consultants / public profiles",
    roles: everyone,
  },
  {
    id: "viewConsultantSlots",
    description: "View a consultant's free slots",
    roles: everyone,
  },
  {
    id: "register",
    description: "Register",
    roles: ["VISITOR"],
  },
  {
    id: "login",
    description: "Log in",
    roles: ["VISITOR"],
  },
  {
    id: "bookAppointment",
    description: "Book an appointment",
    roles: client,
    requirements: { verifiedEmail: true },
  },
  {
    id: "viewOwnAppointments",
    description: "View own appointments",
    roles: clientAndConsultant,
  },
  {
    id: "viewAppointmentMetadata",
    description: "View another user's appointments (metadata only)",
    roles: admin,
    requirements: { metadataOnly: true },
  },
  {
    id: "cancelAppointment",
    description: "Cancel an appointment",
    roles: ["CLIENT", "CONSULTANT", "ADMIN"],
    requirements: { ownership: "own", audited: true },
  },
  {
    id: "rescheduleAppointment",
    description: "Reschedule an appointment",
    roles: ["CLIENT", "CONSULTANT"],
    requirements: { ownership: "own" },
  },
  {
    id: "markAppointmentComplete",
    description: "Mark completed / no-show",
    roles: ["CONSULTANT", "ADMIN"],
    requirements: { ownership: "own" },
  },
  {
    id: "readClientNote",
    description: "Read appointment clientNote",
    roles: ["CLIENT", "CONSULTANT"],
    requirements: { ownership: "own" },
  },
  {
    id: "readAppointmentNote",
    description: "Read/write private AppointmentNote",
    roles: ["CONSULTANT"],
    requirements: { ownership: "own" },
  },
  {
    id: "editOwnClientProfile",
    description: "Edit own client profile",
    roles: client,
  },
  {
    id: "editOwnConsultantProfile",
    description: "Edit own consultant profile",
    roles: consultant,
  },
  {
    id: "editAnyProfile",
    description: "Edit another user's profile",
    roles: [],
  },
  {
    id: "manageAvailability",
    description: "Manage own availability",
    roles: consultant,
    requirements: { approvedConsultant: true },
  },
  {
    id: "leaveReview",
    description: "Leave a review",
    roles: client,
    requirements: { ownership: "own" },
  },
  {
    id: "unpublishReview",
    description: "Unpublish a review",
    roles: admin,
    requirements: { audited: true },
  },
  {
    id: "verifyConsultants",
    description: "Approve / reject / suspend consultants",
    roles: admin,
    requirements: { audited: true },
  },
  {
    id: "suspendReactivateUsers",
    description: "Suspend / reactivate users",
    roles: admin,
    requirements: { audited: true },
  },
  {
    id: "changeUserRole",
    description: "Change a user's role",
    roles: admin,
    requirements: { audited: true },
  },
  {
    id: "manageSpecializations",
    description: "Manage specializations",
    roles: admin,
    requirements: { audited: true },
  },
  {
    id: "readAuditLog",
    description: "Read audit log",
    roles: admin,
  },
];

/**
 * The set of path prefixes that require authentication. `proxy.ts` uses this
 * to redirect anonymous visitors away from protected surfaces without touching
 * the database.
 */
export const protectedPathPrefixes = [
  "/dashboard",
  "/appointments",
  "/profile",
  "/notifications",
  "/consultant",
  "/admin",
] as const;

/**
 * The set of path prefixes that are public marketing / discovery routes.
 * Visitors may reach these without signing in.
 */
export const publicPathPrefixes = ["/", "/consultants", "/legal", "/help", "/crisis-resources"] as const;

/**
 * The set of path prefixes that are auth-only (login / register / reset).
 * Signed-in users are redirected away from these.
 */
export const authOnlyPathPrefixes = ["/login", "/register", "/forgot-password", "/reset-password"] as const;
