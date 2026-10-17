import "server-only";

import { db } from "@/db/client";

export interface AvailabilityRuleRow {
  id: string;
  consultantProfileId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AvailabilityExceptionRow {
  id: string;
  consultantProfileId: string;
  date: Date;
  type: "BLOCK" | "EXTRA";
  startMinute: number | null;
  endMinute: number | null;
  reason: string | null;
  createdAt: Date;
}

/** Fetches all active rules for a consultant. */
export async function getAvailabilityRules(
  consultantProfileId: string,
): Promise<AvailabilityRuleRow[]> {
  return db.availabilityRule.findMany({
    where: { consultantProfileId, isActive: true },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  });
}

/** Fetches all rules (including inactive) for a consultant. */
export async function getAllAvailabilityRules(
  consultantProfileId: string,
): Promise<AvailabilityRuleRow[]> {
  return db.availabilityRule.findMany({
    where: { consultantProfileId },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  });
}

/** Fetches exceptions for a consultant within a date range. */
export async function getAvailabilityExceptions(
  consultantProfileId: string,
  from: Date,
  to: Date,
): Promise<AvailabilityExceptionRow[]> {
  return db.availabilityException.findMany({
    where: {
      consultantProfileId,
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
  });
}

/** Fetches all exceptions for a consultant. */
export async function getAllAvailabilityExceptions(
  consultantProfileId: string,
): Promise<AvailabilityExceptionRow[]> {
  return db.availabilityException.findMany({
    where: { consultantProfileId },
    orderBy: { date: "asc" },
  });
}

/** Creates or updates an availability rule. */
export async function upsertAvailabilityRule(
  consultantProfileId: string,
  input: {
    id?: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
    effectiveFrom?: Date | null;
    effectiveUntil?: Date | null;
    isActive: boolean;
  },
): Promise<AvailabilityRuleRow> {
  if (input.id) {
    return db.availabilityRule.update({
      where: { id: input.id, consultantProfileId },
      data: {
        weekday: input.weekday,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        effectiveFrom: input.effectiveFrom ?? undefined,
        effectiveUntil: input.effectiveUntil ?? undefined,
        isActive: input.isActive,
      },
    });
  }
  return db.availabilityRule.create({
    data: {
      consultantProfileId,
      weekday: input.weekday,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      effectiveFrom: input.effectiveFrom ?? undefined,
      effectiveUntil: input.effectiveUntil ?? undefined,
      isActive: input.isActive,
    },
  });
}

/** Deletes an availability rule. */
export async function deleteAvailabilityRule(
  consultantProfileId: string,
  ruleId: string,
): Promise<void> {
  await db.availabilityRule.delete({
    where: { id: ruleId, consultantProfileId },
  });
}

/** Creates or updates an availability exception. */
export async function upsertAvailabilityException(
  consultantProfileId: string,
  input: {
    id?: string;
    date: Date;
    type: "BLOCK" | "EXTRA";
    startMinute?: number | null;
    endMinute?: number | null;
    reason?: string | null;
  },
): Promise<AvailabilityExceptionRow> {
  if (input.id) {
    return db.availabilityException.update({
      where: { id: input.id, consultantProfileId },
      data: {
        date: input.date,
        type: input.type,
        startMinute: input.startMinute ?? undefined,
        endMinute: input.endMinute ?? undefined,
        reason: input.reason ?? undefined,
      },
    });
  }
  return db.availabilityException.create({
    data: {
      consultantProfileId,
      date: input.date,
      type: input.type,
      startMinute: input.startMinute ?? undefined,
      endMinute: input.endMinute ?? undefined,
      reason: input.reason ?? undefined,
    },
  });
}

/** Deletes an availability exception. */
export async function deleteAvailabilityException(
  consultantProfileId: string,
  exceptionId: string,
): Promise<void> {
  await db.availabilityException.delete({
    where: { id: exceptionId, consultantProfileId },
  });
}

/** Copies a week's rules to the next week (or a specified offset). */
export async function copyWeek(
  consultantProfileId: string,
  sourceWeekOffset = 0,
  targetWeekOffset = 1,
): Promise<{ created: number }> {
  const rules = await getAvailabilityRules(consultantProfileId);

  if (rules.length === 0) return { created: 0 };

  const now = new Date();
  const sourceDate = new Date(now);
  sourceDate.setDate(sourceDate.getDate() + sourceWeekOffset * 7);
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + targetWeekOffset * 7);

  // Format as YYYY-MM-DD for effectiveFrom/effectiveUntil
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const created = await db.availabilityRule.createMany({
    data: rules.map((rule) => ({
      consultantProfileId,
      weekday: rule.weekday,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
      effectiveFrom: new Date(formatDate(targetDate)),
      effectiveUntil: rule.effectiveUntil
        ? new Date(formatDate(new Date(targetDate.getTime() + 6 * 24 * 60 * 60 * 1000)))
        : null,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  return { created: created.count };
}
