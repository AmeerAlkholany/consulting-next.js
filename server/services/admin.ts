import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { AuthorizationError, NotFoundError, ValidationError } from "@/server/errors";
import { writeAuditLog, type AuditContext, type AuditAction } from "./audit";
import { revokeAllSessions } from "@/server/auth/session";
import type { UserStatus, UserRole } from "@/db/generated/prisma/client";
import {
  type UserStatusInput,
  type RoleChangeInput,
  type AdminCancelAppointmentInput,
} from "@/schemas/admin";
import { sendNotification } from "@/server/services/notifications";
import {
  getConsultantApprovedTemplate,
  getConsultantRejectedTemplate,
  getConsultantSuspendedTemplate,
  getAppointmentCancelledTemplate,
} from "@/lib/notification-templates";

/**
 * Admin service for consultant verification, user management, and appointment oversight
 * (IMPLEMENTATION.md Step 9 & Step 15).
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
  return updateVerificationStatus(
    ctx,
    consultantProfileId,
    "APPROVED",
    reason ?? undefined,
    internalNote ?? undefined,
  );
}

/** Rejects a consultant. */
export async function rejectConsultant(
  ctx: AuditContext,
  consultantProfileId: string,
  reason: string,
  internalNote?: string | null,
): Promise<DecisionOutcome> {
  return updateVerificationStatus(
    ctx,
    consultantProfileId,
    "REJECTED",
    reason,
    internalNote ?? undefined,
  );
}

/** Suspends a consultant's verification. */
export async function suspendConsultant(
  ctx: AuditContext,
  consultantProfileId: string,
  reason: string,
  internalNote?: string | null,
): Promise<DecisionOutcome> {
  return updateVerificationStatus(
    ctx,
    consultantProfileId,
    "SUSPENDED",
    reason,
    internalNote ?? undefined,
  );
}

/** Reinstates a suspended consultant. */
export async function reinstateConsultant(
  ctx: AuditContext,
  consultantProfileId: string,
  reason?: string | null,
  internalNote?: string | null,
): Promise<DecisionOutcome> {
  return updateVerificationStatus(
    ctx,
    consultantProfileId,
    "APPROVED",
    reason ?? undefined,
    internalNote ?? undefined,
  );
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
      select: {
        id: true,
        userId: true,
        verificationStatus: true,
        publishedAt: true,
        rejectionReason: true,
      },
    });

    if (!profile) return { status: "not_found" } as NotFoundResult;

    const allowed = validTransitions[profile.verificationStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      return {
        status: "invalid_state",
        currentStatus: profile.verificationStatus,
      } as InvalidStateResult;
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

    // Send notification and email inside transaction (ARCHITECTURE.md §20)
    const consultantUser = await tx.user.findUnique({
      where: { id: profile.userId },
      select: { id: true, email: true, fullName: true },
    });

    if (consultantUser) {
      if (newStatus === "APPROVED") {
        await sendNotification(
          {
            userId: consultantUser.id,
            type: "CONSULTANT_APPROVED",
            payload: {
              title: "Consultant Profile Approved",
              message:
                "Your qualifications have been verified. You can now accept client bookings.",
              consultantProfileId: profile.id,
              link: "/consultant/availability",
            },
            emailDetails: {
              toEmail: consultantUser.email,
              template: "CONSULTANT_APPROVED",
              data: getConsultantApprovedTemplate({
                consultantName: consultantUser.fullName,
              }),
            },
          },
          tx,
        );
      } else if (newStatus === "REJECTED") {
        await sendNotification(
          {
            userId: consultantUser.id,
            type: "CONSULTANT_REJECTED",
            payload: {
              title: "Consultant Application Decision",
              message: `Your application could not be approved at this time: ${reason || "Does not meet current requirements"}`,
              consultantProfileId: profile.id,
              link: "/consultant/profile",
            },
            emailDetails: {
              toEmail: consultantUser.email,
              template: "CONSULTANT_REJECTED",
              data: getConsultantRejectedTemplate({
                consultantName: consultantUser.fullName,
                reason: reason || "Does not meet current requirements",
              }),
            },
          },
          tx,
        );
      } else if (newStatus === "SUSPENDED") {
        await sendNotification(
          {
            userId: consultantUser.id,
            type: "CONSULTANT_SUSPENDED",
            payload: {
              title: "Consultant Profile Suspended",
              message: `Your consultant verification is suspended: ${reason || "Account under review"}`,
              consultantProfileId: profile.id,
              link: "/consultant/profile",
            },
            emailDetails: {
              toEmail: consultantUser.email,
              template: "CONSULTANT_SUSPENDED",
              data: getConsultantSuspendedTemplate({
                consultantName: consultantUser.fullName,
                reason: reason || "Account under review",
              }),
            },
          },
          tx,
        );
      }
    }

    return {
      status: "ok" as const,
      consultantProfileId: profile.id,
      verificationStatus: newStatus,
    } as DecisionResult;
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
      metadata: {
        verificationStatus: result.verificationStatus,
        reason: reason ?? null,
        internalNote: internalNote ?? null,
      },
    });

    logger.info(
      {
        actorId: ctx.actor.id,
        consultantProfileId: result.consultantProfileId,
        newStatus: result.verificationStatus,
      },
      "consultant verification status updated",
    );
  }

  return result;
}

/**
 * Changes a user's account status (ACTIVE, SUSPENDED, DEACTIVATED).
 * BR-12: Suspending a user account revokes every session immediately.
 * Guardrails: An admin cannot modify their own status or suspend the last active admin.
 */
export async function setUserStatus(
  ctx: AuditContext,
  input: UserStatusInput,
): Promise<{ status: "ok"; userId: string; userStatus: UserStatus }> {
  if (ctx.actor.role !== "ADMIN") {
    throw new AuthorizationError("Only administrators can modify user status.");
  }

  if (ctx.actor.id === input.userId) {
    throw new ValidationError("CANNOT_MODIFY_SELF: Administrators cannot modify their own status.");
  }

  const targetUser = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true, status: true, email: true },
  });

  if (!targetUser) {
    throw new NotFoundError("User not found.");
  }

  if (targetUser.role === "ADMIN" && input.status !== "ACTIVE") {
    const activeAdminCount = await db.user.count({
      where: { role: "ADMIN", status: "ACTIVE" },
    });
    if (activeAdminCount <= 1) {
      throw new ValidationError(
        "LAST_ADMIN: Cannot suspend or deactivate the last active administrator.",
      );
    }
  }

  await db.user.update({
    where: { id: input.userId },
    data: { status: input.status as UserStatus },
  });

  // BR-12: Suspending/deactivating revokes all user sessions immediately
  if (input.status === "SUSPENDED" || input.status === "DEACTIVATED") {
    await revokeAllSessions(input.userId);
  }

  const auditAction: AuditAction =
    input.status === "ACTIVE" ? "USER_REACTIVATED" : "USER_SUSPENDED";

  await writeAuditLog(ctx, {
    action: auditAction,
    entityType: "User",
    entityId: input.userId,
    metadata: {
      previousStatus: targetUser.status,
      newStatus: input.status,
      reason: input.reason,
    },
  });

  logger.info(
    { actorId: ctx.actor.id, targetUserId: input.userId, newStatus: input.status },
    "user status updated by admin",
  );

  return { status: "ok", userId: input.userId, userStatus: input.status as UserStatus };
}

/**
 * Changes a user's role (CLIENT, CONSULTANT, ADMIN).
 * ADR: Client becoming consultant keeps client profile; consultant becoming client unpublishes consultant profile.
 * Guardrails: An admin cannot change their own role or demote the last active admin.
 */
export async function changeUserRole(
  ctx: AuditContext,
  input: RoleChangeInput,
): Promise<{ status: "ok"; userId: string; role: UserRole }> {
  if (ctx.actor.role !== "ADMIN") {
    throw new AuthorizationError("Only administrators can modify user roles.");
  }

  if (ctx.actor.id === input.userId) {
    throw new ValidationError("CANNOT_MODIFY_SELF: Administrators cannot modify their own role.");
  }

  const targetUser = await db.user.findUnique({
    where: { id: input.userId },
    include: {
      clientProfile: true,
      consultantProfile: true,
    },
  });

  if (!targetUser) {
    throw new NotFoundError("User not found.");
  }

  if (targetUser.role === input.role) {
    return { status: "ok", userId: input.userId, role: targetUser.role };
  }

  if (targetUser.role === "ADMIN") {
    const activeAdminCount = await db.user.count({
      where: { role: "ADMIN", status: "ACTIVE" },
    });
    if (activeAdminCount <= 1) {
      throw new ValidationError("LAST_ADMIN: Cannot demote the last active administrator.");
    }
  }

  await db.$transaction(async (tx) => {
    // Role change rotates sessions
    await tx.session.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (input.role === "CLIENT" && !targetUser.clientProfile) {
      await tx.clientProfile.create({
        data: {
          userId: targetUser.id,
          displayName: targetUser.fullName.split(" ")[0] || targetUser.fullName,
        },
      });
    }

    if (
      targetUser.role === "CONSULTANT" &&
      input.role !== "CONSULTANT" &&
      targetUser.consultantProfile
    ) {
      // Unpublish consultant profile
      await tx.consultantProfile.update({
        where: { id: targetUser.consultantProfile.id },
        data: { isAcceptingBookings: false },
      });
    }

    await tx.user.update({
      where: { id: input.userId },
      data: { role: input.role as UserRole },
    });
  });

  await writeAuditLog(ctx, {
    action: "USER_ROLE_CHANGED",
    entityType: "User",
    entityId: input.userId,
    metadata: {
      previousRole: targetUser.role,
      newRole: input.role,
      reason: input.reason,
    },
  });

  logger.info(
    { actorId: ctx.actor.id, targetUserId: input.userId, newRole: input.role },
    "user role changed by admin",
  );

  return { status: "ok", userId: input.userId, role: input.role as UserRole };
}

/**
 * Cancels an appointment from administrative oversight.
 * Reason is required and audit log is recorded.
 */
export async function adminCancelAppointment(
  ctx: AuditContext,
  input: AdminCancelAppointmentInput,
): Promise<{ status: "ok"; appointmentId: string }> {
  if (ctx.actor.role !== "ADMIN") {
    throw new AuthorizationError("Only administrators can intervene in appointments.");
  }

  const appointment = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true,
      status: true,
      clientProfileId: true,
      consultantProfileId: true,
    },
  });

  if (!appointment) {
    throw new NotFoundError("Appointment not found.");
  }

  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
    throw new ValidationError(
      `INVALID_STATE: Cannot cancel an appointment in terminal state (${appointment.status}).`,
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const apt = await tx.appointment.update({
      where: { id: input.appointmentId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: ctx.actor.id,
        cancelledBy: "ADMIN",
        cancellationReason: input.reason,
      },
      select: {
        id: true,
        clientProfile: {
          select: {
            userId: true,
            displayName: true,
            user: { select: { email: true } },
          },
        },
        consultantProfile: {
          select: {
            userId: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
    });

    // Notify both client and consultant
    await sendNotification(
      {
        userId: apt.clientProfile.userId,
        type: "APPOINTMENT_CANCELLED",
        payload: {
          title: "Appointment Cancelled by Administration",
          message: `Your consultation has been cancelled by platform administration: ${input.reason}`,
          appointmentId: apt.id,
          link: `/appointments/${apt.id}`,
        },
        emailDetails: {
          toEmail: apt.clientProfile.user.email,
          template: "APPOINTMENT_CANCELLED",
          data: getAppointmentCancelledTemplate({
            recipientName: apt.clientProfile.displayName,
            cancelledByName: "Platform Administration",
            reason: input.reason,
            appointmentId: apt.id,
          }),
        },
      },
      tx,
    );

    await sendNotification(
      {
        userId: apt.consultantProfile.userId,
        type: "APPOINTMENT_CANCELLED",
        payload: {
          title: "Appointment Cancelled by Administration",
          message: `A scheduled consultation has been cancelled by platform administration: ${input.reason}`,
          appointmentId: apt.id,
          link: `/consultant/appointments/${apt.id}`,
        },
        emailDetails: {
          toEmail: apt.consultantProfile.user.email,
          template: "APPOINTMENT_CANCELLED",
          data: getAppointmentCancelledTemplate({
            recipientName: `Dr. ${apt.consultantProfile.user.fullName}`,
            cancelledByName: "Platform Administration",
            reason: input.reason,
            appointmentId: apt.id,
          }),
        },
      },
      tx,
    );

    return apt;
  });

  await writeAuditLog(ctx, {
    action: "APPOINTMENT_CANCELLED_BY_ADMIN",
    entityType: "Appointment",
    entityId: updated.id,
    metadata: {
      previousStatus: appointment.status,
      cancellationReason: input.reason,
    },
  });

  logger.info(
    { actorId: ctx.actor.id, appointmentId: updated.id, reason: input.reason },
    "appointment cancelled by admin",
  );

  return { status: "ok", appointmentId: updated.id };
}
