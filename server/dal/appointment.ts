import "server-only";

import { db } from "@/db/client";
import type { AppointmentStatus, ConsultationType } from "@/db/generated/prisma/client";

export interface ClientAppointmentRow {
  id: string;
  clientProfileId: string;
  consultantProfileId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  consultationType: ConsultationType;
  priceMinor: number;
  currency: string;
  sessionDurationMinutes: number;
  clientTimezone: string;
  consultantTimezone: string;
  clientNote: string | null;
  cancellationReason: string | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  rescheduledFromId: string | null;
  createdAt: Date;
  consultantHeadline: string;
  consultantFullName: string;
  consultantSlug: string;
  cancellationWindowHours: number;
  autoConfirmBookings: boolean;
  review?: {
    id: string;
    rating: number;
    comment: string | null;
    isPublished: boolean;
    createdAt: Date;
  } | null;
}

export type AppointmentTab = "upcoming" | "past" | "cancelled";
export type ConsultantAppointmentTab = "needs_response" | "upcoming" | "past" | "cancelled";

export interface ConsultantAppointmentRow {
  id: string;
  clientProfileId: string;
  consultantProfileId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  consultationType: ConsultationType;
  priceMinor: number;
  currency: string;
  sessionDurationMinutes: number;
  clientTimezone: string;
  consultantTimezone: string;
  clientNote: string | null;
  cancellationReason: string | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  rescheduledFromId: string | null;
  createdAt: Date;
  clientDisplayName: string;
  // Full client contact details: only populated when status in ['CONFIRMED', 'COMPLETED']
  clientEmail?: string | null;
  clientPhone?: string | null;
  review?: {
    id: string;
    rating: number;
    comment: string | null;
    isPublished: boolean;
    createdAt: Date;
  } | null;
}

/**
 * Fetches appointments partitioned by tab for a consultant profile.
 */
export async function getConsultantAppointmentsByTab(
  consultantProfileId: string,
  tab: ConsultantAppointmentTab,
  options: { limit?: number; offset?: number; now?: Date } = {},
): Promise<{ appointments: ConsultantAppointmentRow[]; total: number }> {
  const { limit = 20, offset = 0, now = new Date() } = options;

  let whereClause: Record<string, unknown> = { consultantProfileId };

  if (tab === "needs_response") {
    whereClause = {
      consultantProfileId,
      status: "PENDING",
      startsAt: { gte: now },
    };
  } else if (tab === "upcoming") {
    whereClause = {
      consultantProfileId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { gte: now },
    };
  } else if (tab === "cancelled") {
    whereClause = {
      consultantProfileId,
      status: "CANCELLED",
    };
  } else {
    // past: COMPLETED, NO_SHOW, or past startsAt
    whereClause = {
      consultantProfileId,
      OR: [
        { status: { in: ["COMPLETED", "NO_SHOW"] } },
        {
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { lt: now },
        },
      ],
    };
  }

  const orderBy =
    tab === "upcoming" || tab === "needs_response"
      ? { startsAt: "asc" as const }
      : { startsAt: "desc" as const };

  const [results, total] = await Promise.all([
    db.appointment.findMany({
      where: whereClause,
      orderBy,
      take: limit,
      skip: offset,
      select: {
        id: true,
        clientProfileId: true,
        consultantProfileId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        consultationType: true,
        priceMinor: true,
        currency: true,
        sessionDurationMinutes: true,
        clientTimezone: true,
        consultantTimezone: true,
        clientNote: true,
        cancellationReason: true,
        confirmedAt: true,
        completedAt: true,
        cancelledAt: true,
        rescheduledFromId: true,
        createdAt: true,
        clientProfile: {
          select: {
            displayName: true,
            phone: true,
            user: { select: { email: true } },
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
    }),
    db.appointment.count({ where: whereClause }),
  ]);

  const appointments: ConsultantAppointmentRow[] = results.map((r) => {
    const isContactDisclosed = r.status === "CONFIRMED" || r.status === "COMPLETED";
    return {
      id: r.id,
      clientProfileId: r.clientProfileId,
      consultantProfileId: r.consultantProfileId,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      status: r.status,
      consultationType: r.consultationType,
      priceMinor: r.priceMinor,
      currency: r.currency,
      sessionDurationMinutes: r.sessionDurationMinutes,
      clientTimezone: r.clientTimezone,
      consultantTimezone: r.consultantTimezone,
      clientNote: r.clientNote,
      cancellationReason: r.cancellationReason,
      confirmedAt: r.confirmedAt,
      completedAt: r.completedAt,
      cancelledAt: r.cancelledAt,
      rescheduledFromId: r.rescheduledFromId,
      createdAt: r.createdAt,
      clientDisplayName: r.clientProfile.displayName,
      clientEmail: isContactDisclosed ? r.clientProfile.user.email : null,
      clientPhone: isContactDisclosed ? r.clientProfile.phone : null,
      review: r.review ?? null,
    };
  });

  return { appointments, total };
}

/**
 * Fetches single appointment detail for consultant workspace.
 * IDOR defense: verified against consultantProfileId.
 */
export async function getConsultantAppointmentById(
  consultantProfileId: string,
  appointmentId: string,
): Promise<ConsultantAppointmentRow | null> {
  const r = await db.appointment.findFirst({
    where: {
      id: appointmentId,
      consultantProfileId,
    },
    select: {
      id: true,
      clientProfileId: true,
      consultantProfileId: true,
      startsAt: true,
      endsAt: true,
      status: true,
      consultationType: true,
      priceMinor: true,
      currency: true,
      sessionDurationMinutes: true,
      clientTimezone: true,
      consultantTimezone: true,
      clientNote: true,
      cancellationReason: true,
      confirmedAt: true,
      completedAt: true,
      cancelledAt: true,
      rescheduledFromId: true,
      createdAt: true,
      clientProfile: {
        select: {
          displayName: true,
          phone: true,
          user: { select: { email: true } },
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

  if (!r) return null;

  const isContactDisclosed = r.status === "CONFIRMED" || r.status === "COMPLETED";

  return {
    id: r.id,
    clientProfileId: r.clientProfileId,
    consultantProfileId: r.consultantProfileId,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    consultationType: r.consultationType,
    priceMinor: r.priceMinor,
    currency: r.currency,
    sessionDurationMinutes: r.sessionDurationMinutes,
    clientTimezone: r.clientTimezone,
    consultantTimezone: r.consultantTimezone,
    clientNote: r.clientNote,
    cancellationReason: r.cancellationReason,
    confirmedAt: r.confirmedAt,
    completedAt: r.completedAt,
    cancelledAt: r.cancelledAt,
    rescheduledFromId: r.rescheduledFromId,
    createdAt: r.createdAt,
    clientDisplayName: r.clientProfile.displayName,
    clientEmail: isContactDisclosed ? r.clientProfile.user.email : null,
    clientPhone: isContactDisclosed ? r.clientProfile.phone : null,
    review: r.review ?? null,
  };
}

/**
 * Fetches appointments partitioned by tab for a client profile.
 */
export async function getClientAppointmentsByTab(
  clientProfileId: string,
  tab: AppointmentTab,
  options: { limit?: number; offset?: number; now?: Date } = {},
): Promise<{ appointments: ClientAppointmentRow[]; total: number }> {
  const { limit = 20, offset = 0, now = new Date() } = options;

  let whereClause: Record<string, unknown> = { clientProfileId };

  if (tab === "upcoming") {
    whereClause = {
      clientProfileId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { gte: now },
    };
  } else if (tab === "cancelled") {
    whereClause = {
      clientProfileId,
      status: "CANCELLED",
    };
  } else {
    // past: COMPLETED, NO_SHOW, or past startsAt
    whereClause = {
      clientProfileId,
      OR: [
        { status: { in: ["COMPLETED", "NO_SHOW"] } },
        {
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { lt: now },
        },
      ],
    };
  }

  const orderBy = tab === "upcoming" ? { startsAt: "asc" as const } : { startsAt: "desc" as const };

  const [results, total] = await Promise.all([
    db.appointment.findMany({
      where: whereClause,
      orderBy,
      take: limit,
      skip: offset,
      select: {
        id: true,
        clientProfileId: true,
        consultantProfileId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        consultationType: true,
        priceMinor: true,
        currency: true,
        sessionDurationMinutes: true,
        clientTimezone: true,
        consultantTimezone: true,
        clientNote: true,
        cancellationReason: true,
        confirmedAt: true,
        completedAt: true,
        cancelledAt: true,
        rescheduledFromId: true,
        createdAt: true,
        consultantProfile: {
          select: {
            headline: true,
            slug: true,
            cancellationWindowHours: true,
            autoConfirmBookings: true,
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
    }),
    db.appointment.count({ where: whereClause }),
  ]);

  const appointments: ClientAppointmentRow[] = results.map((r) => ({
    id: r.id,
    clientProfileId: r.clientProfileId,
    consultantProfileId: r.consultantProfileId,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    consultationType: r.consultationType,
    priceMinor: r.priceMinor,
    currency: r.currency,
    sessionDurationMinutes: r.sessionDurationMinutes,
    clientTimezone: r.clientTimezone,
    consultantTimezone: r.consultantTimezone,
    clientNote: r.clientNote,
    cancellationReason: r.cancellationReason,
    confirmedAt: r.confirmedAt,
    completedAt: r.completedAt,
    cancelledAt: r.cancelledAt,
    rescheduledFromId: r.rescheduledFromId,
    createdAt: r.createdAt,
    consultantHeadline: r.consultantProfile.headline,
    consultantFullName: r.consultantProfile.user.fullName,
    consultantSlug: r.consultantProfile.slug,
    cancellationWindowHours: r.consultantProfile.cancellationWindowHours,
    autoConfirmBookings: r.consultantProfile.autoConfirmBookings,
    review: r.review ?? null,
  }));

  return { appointments, total };
}

/**
 * Fetches a single appointment belonging to the client (IDOR defense).
 * Returns null if not owned by the client.
 */
export async function getClientAppointmentById(
  clientProfileId: string,
  appointmentId: string,
): Promise<ClientAppointmentRow | null> {
  const r = await db.appointment.findFirst({
    where: {
      id: appointmentId,
      clientProfileId,
    },
    select: {
      id: true,
      clientProfileId: true,
      consultantProfileId: true,
      startsAt: true,
      endsAt: true,
      status: true,
      consultationType: true,
      priceMinor: true,
      currency: true,
      sessionDurationMinutes: true,
      clientTimezone: true,
      consultantTimezone: true,
      clientNote: true,
      cancellationReason: true,
      confirmedAt: true,
      completedAt: true,
      cancelledAt: true,
      rescheduledFromId: true,
      createdAt: true,
      consultantProfile: {
        select: {
          headline: true,
          slug: true,
          cancellationWindowHours: true,
          autoConfirmBookings: true,
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

  if (!r) return null;

  return {
    id: r.id,
    clientProfileId: r.clientProfileId,
    consultantProfileId: r.consultantProfileId,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    consultationType: r.consultationType,
    priceMinor: r.priceMinor,
    currency: r.currency,
    sessionDurationMinutes: r.sessionDurationMinutes,
    clientTimezone: r.clientTimezone,
    consultantTimezone: r.consultantTimezone,
    clientNote: r.clientNote,
    cancellationReason: r.cancellationReason,
    confirmedAt: r.confirmedAt,
    completedAt: r.completedAt,
    cancelledAt: r.cancelledAt,
    rescheduledFromId: r.rescheduledFromId,
    createdAt: r.createdAt,
    consultantHeadline: r.consultantProfile.headline,
    consultantFullName: r.consultantProfile.user.fullName,
    consultantSlug: r.consultantProfile.slug,
    cancellationWindowHours: r.consultantProfile.cancellationWindowHours,
    autoConfirmBookings: r.consultantProfile.autoConfirmBookings,
    review: r.review ?? null,
  };
}

/**
 * Fetches the very next upcoming appointment for a client dashboard.
 */
export async function getNextClientAppointment(
  clientProfileId: string,
  now = new Date(),
): Promise<ClientAppointmentRow | null> {
  const { appointments } = await getClientAppointmentsByTab(clientProfileId, "upcoming", {
    limit: 1,
    now,
  });
  return appointments[0] ?? null;
}
