import "server-only";

import { db } from "@/db/client";
import { AuthorizationError, ConflictError } from "@/server/errors";
import {
  getAvailabilityRules,
  getAvailabilityExceptions,
  upsertAvailabilityRule,
  deleteAvailabilityRule,
  upsertAvailabilityException,
  deleteAvailabilityException,
  type AvailabilityRuleRow,
  type AvailabilityExceptionRow,
} from "@/server/dal/availability";
import { BOOKING_POLICY } from "@/config/booking";
import { TZDate } from "@date-fns/tz";

/**
 * Availability service (IMPLEMENTATION.md Step 11).
 *
 * Core slot generation engine per ARCHITECTURE.md §19.
 * Pure function: inputs in, slot instants out, no I/O.
 */

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

export interface DaySlots {
  /** Local calendar date string in consultant's timezone (YYYY-MM-DD). */
  date: string;
  slots: Slot[];
}

export interface AvailabilityPreview {
  timezone: string;
  days: DaySlots[];
}

/**
 * Converts a local date string + minutes-from-midnight to UTC instants
 * using the consultant's timezone. Returns null if the time falls in a
 * spring-forward gap.
 */
function localMinuteToInstants(
  localDateStr: string,
  startMinute: number,
  endMinute: number,
  timezone: string,
): { startsAt: Date; endsAt: Date } | null {
  const [year, month, day] = localDateStr.split("-").map(Number);
  const startD = new TZDate(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    timezone,
  );
  startD.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);

  // Gap detection: if the resulting local time doesn't match what we set,
  // the intended time falls in a spring-forward gap.
  if (
    startD.getHours() !== Math.floor(startMinute / 60) ||
    startD.getMinutes() !== startMinute % 60
  ) {
    return null;
  }

  const endD = new TZDate(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    timezone,
  );
  endD.setHours(Math.floor(endMinute / 60), endMinute % 60, 0, 0);
  if (endD.getHours() !== Math.floor(endMinute / 60) || endD.getMinutes() !== endMinute % 60) {
    return null;
  }

  return {
    startsAt: new Date(startD.valueOf()),
    endsAt: new Date(endD.valueOf()),
  };
}

/**
 * Returns the local YYYY-MM-DD string for a UTC Date in the given timezone.
 */
function toLocalDateStr(date: Date, timezone: string): string {
  const z = new TZDate(date, timezone);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
}

/** Generates slots for a single rule over a date range. */
function generateSlotsForRule(
  rule: AvailabilityRuleRow,
  from: Date,
  to: Date,
  consultantTz: string,
  sessionDurationMinutes: number,
): DaySlots[] {
  const days: DaySlots[] = [];

  // Convert from/to to local dates in consultant timezone
  const fromLocal = new TZDate(from, consultantTz);
  const toLocal = new TZDate(to, consultantTz);

  const current = new TZDate(fromLocal);

  while (current.valueOf() <= toLocal.valueOf()) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    const localDateStr = `${year}-${month}-${day}`;

    // rule.weekday: 0=Monday, JS getDay(): 0=Sunday
    const weekday = current.getDay() === 0 ? 6 : current.getDay() - 1;

    if (weekday === rule.weekday) {
      // Check effectiveFrom / effectiveUntil (stored as UTC midnight @db.Date)
      if (rule.effectiveFrom) {
        const effFromStr = toLocalDateStr(rule.effectiveFrom, consultantTz);
        if (localDateStr < effFromStr) {
          current.setDate(current.getDate() + 1);
          continue;
        }
      }
      if (rule.effectiveUntil) {
        const effUntilStr = toLocalDateStr(rule.effectiveUntil, consultantTz);
        if (localDateStr > effUntilStr) {
          break;
        }
      }

      // Generate slots within the rule window
      const result = localMinuteToInstants(
        localDateStr,
        rule.startMinute,
        rule.endMinute,
        consultantTz,
      );
      if (!result) {
        // Time falls in a gap; skip this day
        current.setDate(current.getDate() + 1);
        continue;
      }

      const ruleStart = result.startsAt.valueOf();
      const ruleEnd = result.endsAt.valueOf();

      // Slice into appointment-length slots, stepping by (duration + buffer)
      const slots: Slot[] = [];
      let slotCursor = ruleStart;
      const stepMs = (sessionDurationMinutes + BOOKING_POLICY.slotStepMinutes) * 60 * 1000;
      const durationMs = sessionDurationMinutes * 60 * 1000;

      while (slotCursor + durationMs <= ruleEnd) {
        slots.push({
          startsAt: new Date(slotCursor),
          endsAt: new Date(slotCursor + durationMs),
        });
        slotCursor += stepMs;
      }

      if (slots.length > 0) {
        days.push({ date: localDateStr, slots });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return days;
}

/** Applies exceptions to generated day slots. */
function applyExceptions(
  days: DaySlots[],
  exceptions: AvailabilityExceptionRow[],
  consultantTz: string,
): DaySlots[] {
  // Build exception map keyed by local date string
  const exceptionMap = new Map<string, AvailabilityExceptionRow[]>();

  for (const exc of exceptions) {
    const excLocalDate = toLocalDateStr(exc.date, consultantTz);
    if (!exceptionMap.has(excLocalDate)) exceptionMap.set(excLocalDate, []);
    exceptionMap.get(excLocalDate)!.push(exc);
  }

  return days.map((day) => {
    const dayExceptions = exceptionMap.get(day.date);
    if (!dayExceptions || dayExceptions.length === 0) return day;

    let slots = [...day.slots];

    for (const exc of dayExceptions) {
      if (exc.type === "BLOCK") {
        if (exc.startMinute === null && exc.endMinute === null) {
          // Block whole day
          slots = [];
        } else {
          // Block partial day — compute UTC instants for the blocked interval
          const block = localMinuteToInstants(
            day.date,
            exc.startMinute ?? 0,
            exc.endMinute ?? 1440,
            consultantTz,
          );
          if (block) {
            slots = slots.filter((s) => s.endsAt <= block.startsAt || s.startsAt >= block.endsAt);
          }
        }
      } else if (exc.type === "EXTRA") {
        if (exc.startMinute != null && exc.endMinute != null) {
          const extra = localMinuteToInstants(
            day.date,
            exc.startMinute,
            exc.endMinute,
            consultantTz,
          );
          if (extra) {
            slots.push(extra);
            slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
          }
        }
      }
    }

    return { ...day, slots };
  });
}

/** Removes slots that conflict with existing appointments (including buffer). */
function removeBookedSlots(
  days: DaySlots[],
  appointments: Array<{ startsAt: Date; endsAt: Date }>,
  bufferMinutes: number,
): DaySlots[] {
  if (appointments.length === 0) return days;

  return days.map((day) => {
    let slots = [...day.slots];

    for (const appt of appointments) {
      const bufferedStart = new Date(appt.startsAt.getTime() - bufferMinutes * 60 * 1000);
      const bufferedEnd = new Date(appt.endsAt.getTime() + bufferMinutes * 60 * 1000);

      slots = slots.filter((s) => s.endsAt <= bufferedStart || s.startsAt >= bufferedEnd);
    }

    return { ...day, slots };
  });
}

/** Applies lead time and maximum advance constraints. */
function applyWindowConstraints(
  days: DaySlots[],
  from: Date,
  to: Date,
  leadTimeMinutes: number,
  maxAdvanceMinutes: number,
  now: Date,
  consultantTz: string,
): DaySlots[] {
  const earliestAllowed = new Date(now.getTime() + leadTimeMinutes * 60 * 1000);
  const latestAllowed = new Date(now.getTime() + maxAdvanceMinutes * 60 * 1000);

  // day.date is a local calendar date in consultant's timezone
  const fromDateStr = toLocalDateStr(from, consultantTz);
  const toDateStr = toLocalDateStr(to, consultantTz);

  return days
    .filter((day) => {
      return day.date >= fromDateStr && day.date <= toDateStr;
    })
    .map((day) => ({
      ...day,
      slots: day.slots.filter((s) => s.startsAt >= earliestAllowed && s.startsAt <= latestAllowed),
    }))
    .filter((day) => day.slots.length > 0);
}

/** Main generator function — pure, no I/O. */
export function generateSlots(params: {
  rules: AvailabilityRuleRow[];
  exceptions: AvailabilityExceptionRow[];
  appointments: Array<{ startsAt: Date; endsAt: Date }>;
  bufferMinutes: number;
  leadTimeMinutes: number;
  maxAdvanceMinutes: number;
  from: Date;
  to: Date;
  now: Date;
  consultantTimezone: string;
  sessionDurationMinutes: number;
}): AvailabilityPreview {
  // Generate base slots from rules
  let days: DaySlots[] = [];
  for (const rule of params.rules) {
    days = [
      ...days,
      ...generateSlotsForRule(
        rule,
        params.from,
        params.to,
        params.consultantTimezone,
        params.sessionDurationMinutes,
      ),
    ];
  }

  // Apply exceptions
  days = applyExceptions(days, params.exceptions, params.consultantTimezone);

  // Remove booked slots with buffer
  days = removeBookedSlots(days, params.appointments, params.bufferMinutes);

  // Apply lead time and max advance
  days = applyWindowConstraints(
    days,
    params.from,
    params.to,
    params.leadTimeMinutes,
    params.maxAdvanceMinutes,
    params.now,
    params.consultantTimezone,
  );

  // Sort by date then time
  days.sort((a, b) => a.date.localeCompare(b.date));
  for (const day of days) {
    day.slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  return {
    timezone: params.consultantTimezone,
    days,
  };
}

/** Service methods for mutations. */
export async function upsertRule(
  actor: { id: string },
  input: {
    id?: string;
    consultantProfileId: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
    effectiveFrom?: Date | null;
    effectiveUntil?: Date | null;
    isActive: boolean;
  },
): Promise<void> {
  // Check ownership and fetch timezone
  const profile = await db.consultantProfile.findUnique({
    where: { id: input.consultantProfileId },
    select: { userId: true, timezone: true },
  });
  if (!profile || profile.userId !== actor.id) throw new AuthorizationError("Not your profile.");

  // Check for overlapping active rules on same weekday
  const existing = await db.availabilityRule.findMany({
    where: {
      consultantProfileId: input.consultantProfileId,
      weekday: input.weekday,
      isActive: true,
      ...(input.id ? { id: { not: input.id } } : {}),
    },
  });

  for (const existingRule of existing) {
    if (input.startMinute < existingRule.endMinute && input.endMinute > existingRule.startMinute) {
      const existingStart = `${String(Math.floor(existingRule.startMinute / 60)).padStart(2, "0")}:${String(existingRule.startMinute % 60).padStart(2, "0")}`;
      const existingEnd = `${String(Math.floor(existingRule.endMinute / 60)).padStart(2, "0")}:${String(existingRule.endMinute % 60).padStart(2, "0")}`;
      throw new ConflictError(
        `RULE_OVERLAP: Overlaps with existing ${existingStart}–${existingEnd} rule.`,
      );
    }
  }

  // BR-14: Check if any PENDING/CONFIRMED appointment would be orphaned
  if (input.isActive) {
    const appointments = await db.appointment.findMany({
      where: {
        consultantProfileId: input.consultantProfileId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        clientProfile: { select: { displayName: true } },
      },
    });

    if (appointments.length > 0) {
      // Get all active rules that would exist after this mutation
      const allRules = await db.availabilityRule.findMany({
        where: {
          consultantProfileId: input.consultantProfileId,
          isActive: true,
          ...(input.id ? { id: { not: input.id } } : {}),
        },
        select: { weekday: true, startMinute: true, endMinute: true },
      });

      // Add the new rule
      const newRule = {
        weekday: input.weekday,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
      };
      const allRulesWithNew = [...allRules, newRule];

      const orphaned = appointments.filter((appt) => {
        const localStart = new TZDate(appt.startsAt, profile.timezone);
        const localEnd = new TZDate(appt.endsAt, profile.timezone);
        const apptWeekday = localStart.getDay() === 0 ? 6 : localStart.getDay() - 1;

        const isCovered = allRulesWithNew.some((rule) => {
          if (rule.weekday !== apptWeekday) return false;
          const startMinutes = localStart.getHours() * 60 + localStart.getMinutes();
          const endMinutes = localEnd.getHours() * 60 + localEnd.getMinutes();
          return startMinutes < rule.endMinute && endMinutes > rule.startMinute;
        });

        return !isCovered;
      });

      if (orphaned.length > 0) {
        const details = orphaned
          .map((a) => `${a.id} (${a.clientProfile.displayName}, ${a.startsAt.toISOString()})`)
          .join("; ");
        throw new ConflictError(
          `CONFLICTS_WITH_BOOKED_APPOINTMENTS: ${orphaned.length} appointment(s) would be orphaned. ${details}`,
        );
      }
    }
  }

  await upsertAvailabilityRule(input.consultantProfileId, {
    id: input.id,
    weekday: input.weekday,
    startMinute: input.startMinute,
    endMinute: input.endMinute,
    effectiveFrom: input.effectiveFrom ?? undefined,
    effectiveUntil: input.effectiveUntil ?? undefined,
    isActive: input.isActive,
  });
}

export async function deleteRule(
  actor: { id: string },
  consultantProfileId: string,
  ruleId: string,
): Promise<void> {
  const profile = await db.consultantProfile.findUnique({
    where: { id: consultantProfileId },
    select: { userId: true },
  });
  if (!profile || profile.userId !== actor.id) throw new AuthorizationError("Not your profile.");

  await deleteAvailabilityRule(consultantProfileId, ruleId);
}

export async function upsertException(
  actor: { id: string },
  input: {
    id?: string;
    consultantProfileId: string;
    date: Date;
    type: "BLOCK" | "EXTRA";
    startMinute?: number | null;
    endMinute?: number | null;
    reason?: string | null;
  },
): Promise<void> {
  const profile = await db.consultantProfile.findUnique({
    where: { id: input.consultantProfileId },
    select: { userId: true },
  });
  if (!profile || profile.userId !== actor.id) throw new AuthorizationError("Not your profile.");

  await upsertAvailabilityException(input.consultantProfileId, {
    id: input.id,
    date: input.date,
    type: input.type,
    startMinute: input.startMinute,
    endMinute: input.endMinute,
    reason: input.reason,
  });
}

export async function deleteException(
  actor: { id: string },
  consultantProfileId: string,
  exceptionId: string,
): Promise<void> {
  const profile = await db.consultantProfile.findUnique({
    where: { id: consultantProfileId },
    select: { userId: true },
  });
  if (!profile || profile.userId !== actor.id) throw new AuthorizationError("Not your profile.");

  await deleteAvailabilityException(consultantProfileId, exceptionId);
}

/**
 * Re-buckets slots by the viewer's local calendar date, so the day heading the
 * picker renders matches the times shown next to it. Slot instants are already
 * unambiguous; only their date label depends on the timezone.
 */
function regroupByViewerTimezone(days: DaySlots[], viewerTimezone: string): DaySlots[] {
  const buckets = new Map<string, Slot[]>();

  for (const day of days) {
    for (const slot of day.slots) {
      const localDate = toLocalDateStr(slot.startsAt, viewerTimezone);
      const bucket = buckets.get(localDate);
      if (bucket) {
        bucket.push(slot);
      } else {
        buckets.set(localDate, [slot]);
      }
    }
  }

  return [...buckets.entries()]
    .map(([date, slots]) => ({
      date,
      slots: slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Public API: get availability for a consultant (for slot picker). */
export async function getPublicAvailability(
  slug: string,
  from: Date,
  to: Date,
  viewerTimezone: string,
): Promise<AvailabilityPreview | null> {
  const profile = await db.consultantProfile.findUnique({
    where: {
      slug,
      verificationStatus: "APPROVED",
      isAcceptingBookings: true,
      user: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      id: true,
      timezone: true,
      bufferMinutes: true,
      minLeadTimeHours: true,
      maxAdvanceDays: true,
      sessionDurationMinutes: true,
      user: { select: { id: true } },
    },
  });

  if (!profile) return null;

  const rules = await getAvailabilityRules(profile.id);
  const exceptions = await getAvailabilityExceptions(profile.id, from, to);

  const appointments = await db.appointment.findMany({
    where: {
      consultantProfileId: profile.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { gte: from, lte: to },
    },
    select: { startsAt: true, endsAt: true },
  });

  const slots = generateSlots({
    rules,
    exceptions,
    appointments: appointments.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
    bufferMinutes: profile.bufferMinutes,
    leadTimeMinutes: profile.minLeadTimeHours * 60,
    maxAdvanceMinutes: profile.maxAdvanceDays * 24 * 60,
    from,
    to,
    now: new Date(),
    consultantTimezone: profile.timezone,
    sessionDurationMinutes: profile.sessionDurationMinutes,
  });

  return {
    timezone: viewerTimezone,
    days: regroupByViewerTimezone(slots.days, viewerTimezone),
  };
}
