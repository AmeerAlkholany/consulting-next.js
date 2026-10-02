import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { AuthorizationError, NotFoundError } from "@/server/errors";
import { writeAuditLog, type AuditContext, type AuditAction } from "./audit";
import type { VerificationDecisionInput } from "@/schemas/admin";

/**
 * Admin service for consultant verification (IMPLEMENTATION.md Step 9).
 *
 * Legal transitions:
 * - PENDING → APPROVED | REJECTED
 * - APPROVED → SUSPENDED
 * - REJECTED → PENDING (by consultant resubmission, handled in Step 8)
 * - SUSPENDED → APPROVED (reinstate)
 */

export interface DecisionResult {
  status: "ok";
  consultantProfileId: string;
  verificationStatus: string;
}

export interface InvalidStateResult {
  status: "invalid_state";
  currentStatus: string;
}

export interface NotFoundResult {
  status: "not_found";
}

type DecisionOutcome = DecisionResult | InvalidStateResult | NotFoundResult;

const validTransitions: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED"],
  REJECTED: ["PENDING"], // consultant resubmission
  SUSPENDED: ["APPROVED"],
};

/** Approves a consultant. */
export async function approveConsultant(
  ctx: AuditContext,
  consultantProfileId: string,
  reason?: string | null,
  internalNote?: string | null,
): Promise<DecisionOutcome> {
  return updateVerificationStatus(ctx, consultantProfileId, "APPROVED", reason ?? undefined, internalNote ?? undefined);
}

/** Rejects a consultant. */
export async function rejectConsultant(
  ctx: AuditContext,
  consultantProfileId: string,
  reason: string,
  internalNote?: string | null,
): Promise<DecisionOutcome> {
  return updateVerificationStatus(ctx, consultantProfileId, "REJECTED", reason, internalNote ?? undefined);
}

/** Suspends a consultant's verification. */
export async function suspendConsultant(
  ctx: AuditContext,
  consultantProfileId: string,
  reason: string,
  internalNote?: string | null,
): Promise<DecisionOutcome> {
  return updateVerificationStatus(ctx, consultantProfileId, "SUSPENDED", reason, internalNote ?? undefined);
}

/** Reinstates a suspended consultant. */
export async function reinstateConsultant(
  ctx: AuditContext,
  consultantProfileId: string,
  reason?: string | null,
  internalNote?: string | null,
): Promise<DecisionOutcome> {
  return updateVerificationStatus(ctx, consultantProfileId, "APPROVED", reason ?? undefined, internalNote ?? undefined);
}

/** Core verification status update with transition validation. */
async function updateVerificationStatus(
  ctx: AuditContext,
  consultantProfileId: string,
  newStatus: "APPROVED" | "REJECTED" | "SUSPENDED",
  reason?: string,
  internalNote?: string,
): Promise<DecisionOutcome> {
  const result = await db.$transaction(async (tx) => {
    const profile = await tx.consultantProfile.findUnique({
      where: { id: consultantProfileId },
      select: { id: true, userId: true, verificationStatus: true, publishedAt: true, rejectionReason: true },
    });

    if (!profile) return { status: "not_found" } as NotFoundResult;

    const allowed = validTransitions[profile.verificationStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      return { status: "invalid_state", currentStatus: profile.verificationStatus } as InvalidStateResult;
    }

    // Prevent admin from acting on their own profile
    if (profile.userId === ctx.actor.id) {
      throw new AuthorizationError("Cannot act on your own consultant profile.");
    }

    const now = new Date();
    const data: Record<string, unknown> = {
      verificationStatus: newStatus,
      verificationReviewedAt: now,
      verificationReviewedById: ctx.actor.id,
    };

    if (newStatus === "APPROVED") {
      data.publishedAt = profile.publishedAt ?? now; // first approval sets publishedAt
      data.rejectionReason = null;
    } else if (newStatus === "REJECTED") {
      data.rejectionReason = reason ?? null;
    } else if (newStatus === "SUSPENDED") {
      // keep publishedAt, keep rejectionReason
    }

    await tx.consultantProfile.update({
      where: { id: consultantProfileId },
      data,
    });

    return { status: "ok" as const, consultantProfileId: profile.id, verificationStatus: newStatus } as DecisionResult;
  });

  if (result.status === "ok") {
    const actionMap: Record<string, AuditAction> = {
      APPROVED: "CONSULTANT_APPROVED",
      REJECTED: "CONSULTANT_REJECTED",
      SUSPENDED: "CONSULTANT_SUSPENDED",
    };

    await writeAuditLog(ctx, {
      action: actionMap[result.verificationStatus],
      entityType: "ConsultantProfile",
      entityId: result.consultantProfileId,
      metadata: { verificationStatus: result.verificationStatus, reason: reason ?? null, internalNote: internalNote ?? null },
    });

    logger.info(
      { actorId: ctx.actor.id, consultantProfileId: result.consultantProfileId, newStatus: result.verificationStatus },
      "consultant verification status updated",
    );
  }

  return result;
}