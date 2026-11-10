import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { AuthorizationError, NotFoundError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/dal";
import type { ReviewInput, ReviewEditInput } from "@/schemas/booking";
import { BOOKING_POLICY } from "@/config/booking";

export interface ReviewResult {
  status: "ok";
  reviewId: string;
}

export interface NotFoundResult {
  status: "not_found";
}

export interface AlreadyExistsResult {
  status: "already_exists";
}

export interface NotEligibleResult {
  status: "not_eligible";
  reason: string;
}

type ReviewOutcome = ReviewResult | NotFoundResult | AlreadyExistsResult | NotEligibleResult;

/**
 * Review service (IMPLEMENTATION.md Step 17).
 *
 * Creates and manages reviews for completed appointments.
 * Updates the denormalized ratingSum/ratingCount on the consultant profile.
 */

export async function createReview(actor: SessionUser, input: ReviewInput): Promise<ReviewOutcome> {
  const clientProfile = await db.clientProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });

  if (!clientProfile) {
    return { status: "not_found" };
  }

  const appointment = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true,
      clientProfileId: true,
      consultantProfileId: true,
      status: true,
      endsAt: true,
      review: { select: { id: true } },
      consultantProfile: { select: { ratingSum: true, ratingCount: true } },
    },
  });

  if (!appointment) {
    return { status: "not_found" };
  }

  if (appointment.clientProfileId !== clientProfile.id) {
    throw new AuthorizationError("You don't have access to this appointment.");
  }

  if (appointment.status !== "COMPLETED") {
    return { status: "not_eligible", reason: "Only completed appointments can be reviewed." };
  }

  if (appointment.review) {
    return { status: "already_exists" };
  }

  // Check review window (30 days after completion)
  const reviewWindowMs = BOOKING_POLICY.reviewWindowDays * 24 * 60 * 60 * 1000;
  if (Date.now() - appointment.endsAt.getTime() > reviewWindowMs) {
    return { status: "not_eligible", reason: "The review window has expired." };
  }

  const result = await db.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        appointmentId: input.appointmentId,
        clientProfileId: clientProfile.id,
        consultantProfileId: appointment.consultantProfileId,
        rating: input.rating,
        comment: input.comment,
      },
      select: { id: true },
    });

    // Update denormalized rating aggregate
    await tx.consultantProfile.update({
      where: { id: appointment.consultantProfileId },
      data: {
        ratingSum: { increment: input.rating },
        ratingCount: { increment: 1 },
      },
    });

    return review;
  });

  logger.info({ reviewId: result.id, appointmentId: input.appointmentId }, "review created");

  return { status: "ok", reviewId: result.id };
}

export async function editReview(
  actor: SessionUser,
  input: ReviewEditInput,
): Promise<{ status: "ok"; reviewId: string } | { status: "error"; message: string }> {
  const clientProfile = await db.clientProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });

  if (!clientProfile) {
    throw new NotFoundError("Client profile not found.");
  }

  const review = await db.review.findUnique({
    where: { id: input.reviewId },
    select: {
      id: true,
      clientProfileId: true,
      consultantProfileId: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  });

  if (!review) {
    throw new NotFoundError("Review not found.");
  }

  if (review.clientProfileId !== clientProfile.id) {
    throw new AuthorizationError("You don't have access to this review.");
  }

  // Check edit window (48 hours)
  const editWindowMs = BOOKING_POLICY.reviewEditWindowHours * 60 * 60 * 1000;
  if (Date.now() - review.createdAt.getTime() > editWindowMs) {
    return { status: "error", message: "The review edit window has expired (48 hours)." };
  }

  const oldRating = review.rating;

  await db.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: input.reviewId },
      data: {
        rating: input.rating,
        comment: input.comment,
      },
    });

    // Adjust denormalized rating aggregate
    const diff = input.rating - oldRating;
    await tx.consultantProfile.update({
      where: { id: review.consultantProfileId },
      data: {
        ratingSum: { increment: diff },
      },
    });
  });

  logger.info({ reviewId: input.reviewId }, "review edited");

  return { status: "ok", reviewId: input.reviewId };
}

export async function getConsultantReviews(
  consultantProfileId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<
  Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    clientDisplayName: string;
  }>
> {
  const { limit = 10, offset = 0 } = options;

  const results = await db.review.findMany({
    where: { consultantProfileId, isPublished: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      clientProfile: { select: { displayName: true } },
    },
  });

  return results.map((r) => ({
    ...r,
    clientDisplayName: r.clientProfile.displayName,
  }));
}
