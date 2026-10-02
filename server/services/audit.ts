import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import type { SessionUser } from "@/server/auth/session";

/**
 * Audit logging service (ARCHITECTURE.md §21, BR-13).
 *
 * Every consequential admin action writes an AuditLog row through this helper.
 * The metadata is deliberately restricted to non-sensitive data — no free text,
 * no clinical notes, no PII beyond the actor and target identifiers.
 */

export interface AuditContext {
  actor: SessionUser;
  ipHash?: string;
}

import { Prisma } from "@/db/generated/prisma/client";

export async function writeAuditLog(
  ctx: AuditContext,
  entry: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    metadata: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorUserId: ctx.actor.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
      ipHash: ctx.ipHash ?? null,
    },
  });

  logger.info(
    { actorId: ctx.actor.id, action: entry.action, entityType: entry.entityType, entityId: entry.entityId },
    "audit log written",
  );
}

/** Pre-defined action names matching the Prisma AuditAction enum. */
export type AuditAction =
  | "USER_SUSPENDED"
  | "USER_REACTIVATED"
  | "USER_ROLE_CHANGED"
  | "CONSULTANT_APPROVED"
  | "CONSULTANT_REJECTED"
  | "CONSULTANT_SUSPENDED"
  | "APPOINTMENT_CANCELLED_BY_ADMIN"
  | "SPECIALIZATION_CREATED"
  | "SPECIALIZATION_UPDATED"
  | "SPECIALIZATION_DISABLED"
  | "REVIEW_UNPUBLISHED";