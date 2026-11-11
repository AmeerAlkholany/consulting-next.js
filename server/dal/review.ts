import "server-only";

import { db } from "@/db/client";
import { formatClientPublicName } from "@/schemas/review";
import { BOOKING_POLICY } from "@/config/booking";

export interface PublicReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  authorName: string;
}

export interface ConsultantReviewItem {
  id: string;
  appointmentId: string;
  rating: number;
  comment: string | null;
  isPublished: boolean;
  moderatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorName: string;
  appointmentStartsAt: Date;
  appointmentEndsAt: Date;
}

/**
 * Public listing of published reviews for a consultant profile.
 * Anonymizes author identity to first name + last initial (ARCHITECTURE.md §17).
 */
export async function getPublicReviewsForConsultant(
  consultantProfileId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<{
  reviews: PublicReviewItem[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(50, Math.max(1, options.perPage ?? 10));
  const skip = (page - 1) * perPage;

  const where = {
    consultantProfileId,
    isPublished: true,
  };

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        clientProfile: {
          select: {
            displayName: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    }),
    db.review.count({ where }),
  ]);

  const items: PublicReviewItem[] = reviews.map((r) => {
    const rawName = r.clientProfile.displayName || r.clientProfile.user.fullName;
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      authorName: formatClientPublicName(rawName),
    };
  });

  return {
    reviews: items,
    total,
    page,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Consultant's authenticated view of their own reviews (including unpublished ones).
 */
export async function getConsultantReviews(
  consultantProfileId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<{
  reviews: ConsultantReviewItem[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(50, Math.max(1, options.perPage ?? 10));
  const skip = (page - 1) * perPage;

  const where = { consultantProfileId };

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      select: {
        id: true,
        appointmentId: true,
        rating: true,
        comment: true,
        isPublished: true,
        moderatedById: true,
        createdAt: true,
        updatedAt: true,
        clientProfile: {
          select: {
            displayName: true,
            user: { select: { fullName: true } },
          },
        },
        appointment: {
          select: {
            startsAt: true,
            endsAt: true,
          },
        },
      },
    }),
    db.review.count({ where }),
  ]);

  const items: ConsultantReviewItem[] = reviews.map((r) => {
    const rawName = r.clientProfile.displayName || r.clientProfile.user.fullName;
    return {
      id: r.id,
      appointmentId: r.appointmentId,
      rating: r.rating,
      comment: r.comment,
      isPublished: r.isPublished,
      moderatedById: r.moderatedById,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      authorName: formatClientPublicName(rawName),
      appointmentStartsAt: r.appointment.startsAt,
      appointmentEndsAt: r.appointment.endsAt,
    };
  });

  return {
    reviews: items,
    total,
    page,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Fetches review by appointment ID.
 */
export async function getReviewByAppointmentId(appointmentId: string) {
  return db.review.findUnique({
    where: { appointmentId },
    select: {
      id: true,
      appointmentId: true,
      clientProfileId: true,
      consultantProfileId: true,
      rating: true,
      comment: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Finds completed appointments for a client that are within the 30-day review window
 * and have not been reviewed yet (for dashboard review prompt).
 */
export async function getClientReviewableAppointments(
  clientProfileId: string,
  now: Date = new Date(),
) {
  const windowStart = new Date(
    now.getTime() - BOOKING_POLICY.reviewWindowDays * 24 * 60 * 60 * 1000,
  );

  return db.appointment.findMany({
    where: {
      clientProfileId,
      status: "COMPLETED",
      endsAt: { gte: windowStart },
      review: null,
    },
    orderBy: { endsAt: "desc" },
    take: 5,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      consultationType: true,
      consultantProfile: {
        select: {
          id: true,
          slug: true,
          user: {
            select: {
              fullName: true,
            },
          },
        },
      },
    },
  });
}
