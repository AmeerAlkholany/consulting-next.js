import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { AuthorizationError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/dal";
import { getClientProfile } from "@/server/dal/client-profile";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import { getAvailabilityRules, getAvailabilityExceptions } from "@/server/dal/availability";
import { generateSlots } from "@/server/services/availability";
import type {
  BookingInput,
  CancelAppointmentInput,
  RescheduleAppointmentInput,
} from "@/schemas/booking";
import { BOOKING_POLICY } from "@/config/booking";

export interface BookingResult {
  status: "ok";
  appointmentId: string;
  autoConfirmed: boolean;
}

export interface ConflictResult {
  status: "conflict";
  message: string;
}

export interface NotFoundResult {
  status: "not_found";
}

type BookingOutcome = BookingResult | ConflictResult | NotFoundResult;

/**
 * Booking service (IMPLEMENTATION.md Step 12).
 *
 * Creates appointments with transaction handling, idempotency, and database-level
 * exclusion constraints preventing overlapping bookings.
 */

export async function createBooking(
  actor: SessionUser,
  input: BookingInput,
): Promise<BookingOutcome> {
  const clientProfile = await getClientProfile(actor.id);
  if (!clientProfile) {
    logger.warn({ userId: actor.id }, "booking attempted without client profile");
    return { status: "not_found" };
  }

  const consultantProfile = await db.consultantProfile.findUnique({
    where: { id: input.consultantProfileId },
    select: {
      id: true,
      userId: true,
      timezone: true,
      sessionDurationMinutes: true,
      bufferMinutes: true,
      minLeadTimeHours: true,
      maxAdvanceDays: true,
      autoConfirmBookings: true,
      verificationStatus: true,
      isAcceptingBookings: true,
      user: { select: { status: true, deletedAt: true } },
      sessionPriceMinor: true,
      currency: true,
    },
  });

  if (!consultantProfile) {
    return { status: "not_found" };
  }

  if (
    consultantProfile.verificationStatus !== "APPROVED" ||
    consultantProfile.user.status !== "ACTIVE" ||
    consultantProfile.user.deletedAt !== null ||
    !consultantProfile.isAcceptingBookings
  ) {
    return { status: "not_found" };
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const now = new Date();

  // Validate lead time
  const leadTimeMs = consultantProfile.minLeadTimeHours * 60 * 60 * 1000;
  if (startsAt.getTime() - now.getTime() < leadTimeMs) {
    return {
      status: "conflict",
      message: `Bookings must be made at least ${consultantProfile.minLeadTimeHours} hours in advance.`,
    };
  }

  // Validate max advance
  const maxAdvanceMs = consultantProfile.maxAdvanceDays * 24 * 60 * 60 * 1000;
  if (startsAt.getTime() - now.getTime() > maxAdvanceMs) {
    return {
      status: "conflict",
      message: `Bookings cannot be made more than ${consultantProfile.maxAdvanceDays} days in advance.`,
    };
  }

  // Check idempotency
  if (input.idempotencyKey) {
    const existing = await db.appointment.findUnique({
      where: { requestIdempotencyKey: input.idempotencyKey },
      select: { id: true, status: true },
    });
    if (existing) {
      return { status: "ok", appointmentId: existing.id, autoConfirmed: false };
    }
  }

  // Verify the slot exists in generated availability
  const rules = await getAvailabilityRules(consultantProfile.id);
  const exceptions = await getAvailabilityExceptions(consultantProfile.id, startsAt, endsAt);

  const bookingWindow = new Date(startsAt);
  bookingWindow.setDate(bookingWindow.getDate() + 7);

  const preview = generateSlots({
    rules,
    exceptions,
    appointments: [],
    bufferMinutes: consultantProfile.bufferMinutes,
    leadTimeMinutes: consultantProfile.minLeadTimeHours * 60,
    maxAdvanceMinutes: consultantProfile.maxAdvanceDays * 24 * 60,
    from: now,
    to: bookingWindow,
    now,
    consultantTimezone: consultantProfile.timezone,
    sessionDurationMinutes: consultantProfile.sessionDurationMinutes,
  });

  const slotExists = preview.days.some((day) =>
    day.slots.some((slot) => slot.startsAt.getTime() === startsAt.getTime()),
  );

  if (!slotExists) {
    return {
      status: "conflict",
      message: "Selected slot is no longer available.",
    };
  }

  // Create the appointment in a transaction
  const result = await db.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        clientProfileId: clientProfile.id,
        consultantProfileId: consultantProfile.id,
        startsAt,
        endsAt,
        clientTimezone: actor.timezone,
        consultantTimezone: consultantProfile.timezone,
        status: "PENDING",
        consultationType: input.consultationType,
        priceMinor: consultantProfile.sessionPriceMinor,
        currency: consultantProfile.currency,
        sessionDurationMinutes: consultantProfile.sessionDurationMinutes,
        clientNote: input.clientNote,
        requestIdempotencyKey: input.idempotencyKey,
      },
      select: { id: true, status: true },
    });

    return appointment;
  });

  const autoConfirmed = consultantProfile.autoConfirmBookings;

  if (autoConfirmed && result.status === "PENDING") {
    await db.appointment.update({
      where: { id: result.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
  }

  logger.info(
    { appointmentId: result.id, consultantId: consultantProfile.id, clientId: actor.id },
    "booking created",
  );

  return {
    status: "ok",
    appointmentId: result.id,
    autoConfirmed,
  };
}

export async function cancelAppointment(
  actor: SessionUser,
  input: CancelAppointmentInput,
): Promise<{ status: "ok"; appointmentId: string } | { status: "error"; message: string }> {
  const clientProfile = await getClientProfile(actor.id);
  const consultantProfile = await getConsultantProfile(actor.id);

  const appointment = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true,
      clientProfileId: true,
      consultantProfileId: true,
      status: true,
      startsAt: true,
      clientProfile: { select: { userId: true } },
      consultantProfile: { select: { userId: true } },
    },
  });

  if (!appointment) {
    return { status: "error", message: "Appointment not found." };
  }

  const isClient = clientProfile?.id === appointment.clientProfileId;
  const isConsultant = consultantProfile?.id === appointment.consultantProfileId;

  if (!isClient && !isConsultant) {
    throw new AuthorizationError("You don't have access to this appointment.");
  }

  if (appointment.status === "CANCELLED") {
    return { status: "error", message: "Appointment is already cancelled." };
  }

  const hoursUntilStart = (appointment.startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
  const cancellationWindow = BOOKING_POLICY.defaultCancellationWindowHours;

  if (hoursUntilStart < cancellationWindow && isClient) {
    return {
      status: "error",
      message: `Cancellations must be made at least ${cancellationWindow} hours before the appointment.`,
    };
  }

  await db.appointment.update({
    where: { id: input.appointmentId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById: actor.id,
      cancelledBy: isClient ? "CLIENT" : isConsultant ? "CONSULTANT" : "ADMIN",
      cancellationReason: input.reason ?? null,
    },
  });

  logger.info({ appointmentId: input.appointmentId, actorId: actor.id }, "appointment cancelled");

  return { status: "ok", appointmentId: input.appointmentId };
}

export async function rescheduleAppointment(
  actor: SessionUser,
  input: RescheduleAppointmentInput,
): Promise<{ status: "ok"; newAppointmentId: string } | { status: "error"; message: string }> {
  const clientProfile = await getClientProfile(actor.id);

  const appointment = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true,
      clientProfileId: true,
      consultantProfileId: true,
      status: true,
      startsAt: true,
      rescheduledFromId: true,
      consultationType: true,
      priceMinor: true,
      currency: true,
      clientNote: true,
      clientProfile: { select: { userId: true } },
    },
  });

  if (!appointment) {
    return { status: "error", message: "Appointment not found." };
  }

  if (clientProfile?.id !== appointment.clientProfileId) {
    throw new AuthorizationError("You don't have access to this appointment.");
  }

  if (appointment.status !== "CONFIRMED" && appointment.status !== "PENDING") {
    return {
      status: "error",
      message: "Only confirmed or pending appointments can be rescheduled.",
    };
  }

  if (appointment.rescheduledFromId) {
    return { status: "error", message: "This appointment has already been rescheduled." };
  }

  const newStartsAt = new Date(input.startsAt);
  const newEndsAt = new Date(input.endsAt);

  // Validate the new slot
  const consultantProfile = await db.consultantProfile.findUnique({
    where: { id: appointment.consultantProfileId },
    select: {
      id: true,
      timezone: true,
      sessionDurationMinutes: true,
      bufferMinutes: true,
      minLeadTimeHours: true,
      maxAdvanceDays: true,
    },
  });

  if (!consultantProfile) {
    return { status: "error", message: "Consultant not found." };
  }

  const rules = await getAvailabilityRules(consultantProfile.id);
  const exceptions = await getAvailabilityExceptions(consultantProfile.id, newStartsAt, newEndsAt);

  const bookingWindow = new Date(newStartsAt);
  bookingWindow.setDate(bookingWindow.getDate() + 7);

  const preview = generateSlots({
    rules,
    exceptions,
    appointments: [],
    bufferMinutes: consultantProfile.bufferMinutes,
    leadTimeMinutes: consultantProfile.minLeadTimeHours * 60,
    maxAdvanceMinutes: consultantProfile.maxAdvanceDays * 24 * 60,
    from: new Date(),
    to: bookingWindow,
    now: new Date(),
    consultantTimezone: consultantProfile.timezone,
    sessionDurationMinutes: consultantProfile.sessionDurationMinutes,
  });

  const slotExists = preview.days.some((day) =>
    day.slots.some((slot) => slot.startsAt.getTime() === newStartsAt.getTime()),
  );

  if (!slotExists) {
    return { status: "error", message: "Selected slot is no longer available." };
  }

  const result = await db.$transaction(async (tx) => {
    // Cancel the old appointment
    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: "CLIENT",
        rescheduledFromId: appointment.id,
      },
    });

    // Create the new appointment
    const newAppointment = await tx.appointment.create({
      data: {
        clientProfileId: appointment.clientProfileId,
        consultantProfileId: appointment.consultantProfileId,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        clientTimezone: actor.timezone,
        consultantTimezone: consultantProfile.timezone,
        status: "PENDING",
        consultationType: appointment.consultationType,
        priceMinor: appointment.priceMinor,
        currency: appointment.currency,
        sessionDurationMinutes: consultantProfile.sessionDurationMinutes,
        clientNote: input.clientNote ?? appointment.clientNote,
      },
      select: { id: true },
    });

    return newAppointment;
  });

  logger.info({ oldId: appointment.id, newId: result.id }, "appointment rescheduled");

  return { status: "ok", newAppointmentId: result.id };
}

export interface AppointmentCountResult {
  upcoming: number;
  pending: number;
  completed: number;
}

export async function getAppointmentCounts(actor: SessionUser): Promise<AppointmentCountResult> {
  const clientProfile = await getClientProfile(actor.id);
  const consultantProfile = await getConsultantProfile(actor.id);

  const now = new Date();

  if (clientProfile) {
    const [upcoming, pending] = await Promise.all([
      db.appointment.count({
        where: {
          clientProfileId: clientProfile.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { gte: now },
        },
      }),
      db.appointment.count({
        where: {
          clientProfileId: clientProfile.id,
          status: "PENDING",
        },
      }),
    ]);

    const completed = await db.appointment.count({
      where: {
        clientProfileId: clientProfile.id,
        status: "COMPLETED",
      },
    });

    return { upcoming, pending, completed };
  }

  if (consultantProfile) {
    const [upcoming, pending] = await Promise.all([
      db.appointment.count({
        where: {
          consultantProfileId: consultantProfile.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { gte: now },
        },
      }),
      db.appointment.count({
        where: {
          consultantProfileId: consultantProfile.id,
          status: "PENDING",
        },
      }),
    ]);

    const completed = await db.appointment.count({
      where: {
        consultantProfileId: consultantProfile.id,
        status: "COMPLETED",
      },
    });

    return { upcoming, pending, completed };
  }

  return { upcoming: 0, pending: 0, completed: 0 };
}

export async function getClientAppointments(
  clientProfileId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<
  Array<{
    id: string;
    consultantProfileId: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    consultationType: string;
    priceMinor: number;
    currency: string;
    clientNote: string | null;
    createdAt: Date;
    clientDisplayName: string;
    consultantHeadline: string;
    consultantFullName: string;
    review?: {
      id: string;
      rating: number;
      comment: string | null;
      isPublished: boolean;
      createdAt: Date;
    } | null;
  }>
> {
  const { limit = 10, offset = 0 } = options;

  const results = await db.appointment.findMany({
    where: { clientProfileId },
    orderBy: { startsAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      consultantProfileId: true,
      startsAt: true,
      endsAt: true,
      status: true,
      consultationType: true,
      priceMinor: true,
      currency: true,
      clientNote: true,
      createdAt: true,
      clientProfile: { select: { displayName: true } },
      consultantProfile: {
        select: {
          headline: true,
          user: { select: { fullName: true } },
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          isPublished: true,
          createdAt: true,
        },
      },
    },
  });

  return results.map((r) => ({
    ...r,
    clientDisplayName: r.clientProfile.displayName,
    consultantHeadline: r.consultantProfile.headline,
    consultantFullName: r.consultantProfile.user.fullName,
    review: r.review ?? null,
  }));
}

export async function getConsultantAppointments(
  consultantProfileId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<
  Array<{
    id: string;
    clientProfileId: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    consultationType: string;
    priceMinor: number;
    currency: string;
    clientNote: string | null;
    createdAt: Date;
    clientDisplayName: string;
    consultantHeadline: string;
    consultantFullName: string;
    review?: {
      id: string;
      rating: number;
      comment: string | null;
      isPublished: boolean;
      createdAt: Date;
    } | null;
  }>
> {
  const { limit = 20, offset = 0 } = options;

  const results = await db.appointment.findMany({
    where: { consultantProfileId },
    orderBy: { startsAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      clientProfileId: true,
      startsAt: true,
      endsAt: true,
      status: true,
      consultationType: true,
      priceMinor: true,
      currency: true,
      clientNote: true,
      createdAt: true,
      clientProfile: { select: { displayName: true } },
      consultantProfile: {
        select: {
          headline: true,
          user: { select: { fullName: true } },
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          isPublished: true,
          createdAt: true,
        },
      },
    },
  });

  return results.map((r) => ({
    ...r,
    clientDisplayName: r.clientProfile.displayName,
    consultantHeadline: r.consultantProfile.headline,
    consultantFullName: r.consultantProfile.user.fullName,
    review: r.review ?? null,
  }));
}
