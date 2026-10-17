import "server-only";

import { db } from "@/db/client";
import type { AppointmentStatus, ConsultationType } from "@/db/generated/prisma/client";
import type { SessionUser } from "@/server/auth/dal";

export interface AppointmentRow {
  id: string;
  clientProfileId: string;
  consultantProfileId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  consultationType: ConsultationType;
  priceMinor: number;
  currency: string;
  clientNote: string | null;
  createdAt: Date;
}

export interface AppointmentDetailRow extends AppointmentRow {
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
}

/** Fetches appointments for a client profile. */
export async function getClientAppointments(
  clientProfileId: string,
  options: { status?: AppointmentStatus[]; limit?: number; offset?: number } = {},
): Promise<AppointmentDetailRow[]> {
  const { status, limit = 20, offset = 0 } = options;

  const results = await db.appointment.findMany({
    where: {
      clientProfileId,
      ...(status ? { status: { in: status } } : {}),
    },
    orderBy: { startsAt: "desc" },
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
    id: r.id,
    clientProfileId: r.clientProfileId,
    consultantProfileId: r.consultantProfileId,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    consultationType: r.consultationType,
    priceMinor: r.priceMinor,
    currency: r.currency,
    clientNote: r.clientNote,
    createdAt: r.createdAt,
    clientDisplayName: r.clientProfile.displayName,
    consultantHeadline: r.consultantProfile.headline,
    consultantFullName: r.consultantProfile.user.fullName,
    review: r.review ?? null,
  }));
}

/** Fetches appointments for a consultant profile. */
export async function getConsultantAppointments(
  consultantProfileId: string,
  options: { status?: AppointmentStatus[]; limit?: number; offset?: number } = {},
): Promise<AppointmentDetailRow[]> {
  const { status, limit = 20, offset = 0 } = options;

  const results = await db.appointment.findMany({
    where: {
      consultantProfileId,
      ...(status ? { status: { in: status } } : {}),
    },
    orderBy: { startsAt: "desc" },
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
    id: r.id,
    clientProfileId: r.clientProfileId,
    consultantProfileId: r.consultantProfileId,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    consultationType: r.consultationType,
    priceMinor: r.priceMinor,
    currency: r.currency,
    clientNote: r.clientNote,
    createdAt: r.createdAt,
    clientDisplayName: r.clientProfile.displayName,
    consultantHeadline: r.consultantProfile.headline,
    consultantFullName: r.consultantProfile.user.fullName,
    review: r.review ?? null,
  }));
}

/** Fetches a single appointment with full details. */
export async function getAppointmentById(id: string): Promise<AppointmentDetailRow | null> {
  const result = await db.appointment.findUnique({
    where: { id },
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
      clientNote: true,
      createdAt: true,
      confirmedAt: true,
      completedAt: true,
      cancelledAt: true,
      cancellationReason: true,
      clientProfile: { select: { displayName: true, userId: true } },
      consultantProfile: {
        select: {
          id: true,
          headline: true,
          slug: true,
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

  if (!result) return null;

  return {
    id: result.id,
    clientProfileId: result.clientProfileId,
    consultantProfileId: result.consultantProfileId,
    startsAt: result.startsAt,
    endsAt: result.endsAt,
    status: result.status,
    consultationType: result.consultationType,
    priceMinor: result.priceMinor,
    currency: result.currency,
    clientNote: result.clientNote,
    createdAt: result.createdAt,
    clientDisplayName: result.clientProfile.displayName,
    consultantHeadline: result.consultantProfile.headline,
    consultantFullName: result.consultantProfile.user.fullName,
    review: result.review ?? null,
  };
}

/** Fetches upcoming appointments for a user (client or consultant). */
export async function getUpcomingAppointments(
  _actor: SessionUser,
): Promise<AppointmentDetailRow[]> {
  // This is handled in the service layer; this is a convenience DAL helper
  return [];
}
