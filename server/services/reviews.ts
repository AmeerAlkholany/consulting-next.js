import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { AuthorizationError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/dal";
import {
  createReviewSchema,
  updateReviewSchema,
  unpublishReviewSchema,
  isWithinReviewEditWindow,
  isEligibleForReview,
  type CreateReviewInput,
  type UpdateReviewInput,
  type UnpublishReviewInput,
} from "@/schemas/review";
import { sendNotification } from "@/server/services/notifications";
import { getReviewReceivedTemplate } from "@/lib/notification-templates";
import { Prisma } from "@/db/generated/prisma/client";

export interface ReviewSuccessResult {
  status: "ok";
  reviewId: string;
}

export interface ReviewErrorResult {
  status: "error";
  code:
    | "NOT_ELIGIBLE"
    | "ALREADY_REVIEWED"
    | "REVIEW_WINDOW_CLOSED"
    | "EDIT_WINDOW_CLOSED"
    | "NOT_FOUND";
  message: string;
}

export type ReviewMutationResult = ReviewSuccessResult | ReviewErrorResult;

/**
 * Creates a review for a completed appointment (BR-9).
 * - Enforces client ownership, COMPLETED appointment status, single review, and 30-day review window.
 * - Atomically inserts the review and increments consultant ratingSum and ratingCount.
 * - Emits in-transaction REVIEW_RECEIVED notification and email outbox row to consultant.
 */
export async function createReview(
  actor: SessionUser,
  input: CreateReviewInput,
): Promise<ReviewMutationResult> {
  if (actor.role !== "CLIENT") {
    throw new AuthorizationError("Only clients can submit reviews.");
  }

  const validated = createReviewSchema.parse(input);

  const clientProfile = await db.clientProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true, displayName: true, user: { select: { fullName: true } } },
  });

  if (!clientProfile) {
    return {
      status: "error",
      code: "NOT_FOUND",
      message: "Client profile not found.",
    };
  }

  const appointment = await db.appointment.findUnique({
    where: { id: validated.appointmentId },
    select: {
      id: true,
      clientProfileId: true,
      consultantProfileId: true,
      status: true,
      endsAt: true,
      review: { select: { id: true } },
      consultantProfile: {
        select: {
          id: true,
          slug: true,
          userId: true,
          user: { select: { fullName: true, email: true } },
        },
      },
    },
  });

  if (!appointment) {
    return {
      status: "error",
      code: "NOT_FOUND",
      message: "Appointment not found.",
    };
  }

  if (appointment.clientProfileId !== clientProfile.id) {
    throw new AuthorizationError("You do not have access to review this appointment.");
  }

  const eligibility = isEligibleForReview(appointment);
  if (!eligibility.eligible) {
    const isWindowClosed = eligibility.reason?.includes("review window");
    return {
      status: "error",
      code: isWindowClosed ? "REVIEW_WINDOW_CLOSED" : "NOT_ELIGIBLE",
      message: eligibility.reason || "Appointment is not eligible for review.",
    };
  }

  if (appointment.review) {
    return {
      status: "error",
      code: "ALREADY_REVIEWED",
      message: "This appointment has already been reviewed.",
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Create the review
      const review = await tx.review.create({
        data: {
          appointmentId: appointment.id,
          clientProfileId: clientProfile.id,
          consultantProfileId: appointment.consultantProfileId,
          rating: validated.rating,
          comment: validated.comment,
          isPublished: true,
        },
        select: { id: true },
      });

      // Update consultant denormalized aggregate atomically
      await tx.consultantProfile.update({
        where: { id: appointment.consultantProfileId },
        data: {
          ratingSum: { increment: validated.rating },
          ratingCount: { increment: 1 },
        },
      });

      // Send in-transaction notification to consultant
      const consultantName = appointment.consultantProfile.user.fullName;
      const emailTemplate = getReviewReceivedTemplate({
        consultantName,
        rating: validated.rating,
      });

      await sendNotification(
        {
          userId: appointment.consultantProfile.userId,
          type: "REVIEW_RECEIVED",
          payload: {
            title: "New Review Received",
            message: `You received a ${validated.rating}-star review for a completed consultation.`,
            appointmentId: appointment.id,
            consultantProfileId: appointment.consultantProfileId,
            link: "/consultant/reviews",
          },
          emailDetails: {
            toEmail: appointment.consultantProfile.user.email,
            template: "REVIEW_RECEIVED",
            data: emailTemplate,
          },
        },
        tx,
      );

      return review;
    });

    logger.info(
      { reviewId: result.id, appointmentId: appointment.id, rating: validated.rating },
      "review created and rating aggregates updated",
    );

    return { status: "ok", reviewId: result.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        code: "ALREADY_REVIEWED",
        message: "A review already exists for this appointment.",
      };
    }
    throw error;
  }
}

/**
 * Updates a review within the 48-hour edit window.
 * - Re-adjusts consultant ratingSum if rating changed.
 */
export async function updateReview(
  actor: SessionUser,
  input: UpdateReviewInput,
): Promise<ReviewMutationResult> {
  if (actor.role !== "CLIENT") {
    throw new AuthorizationError("Only clients can edit their reviews.");
  }

  const validated = updateReviewSchema.parse(input);

  const clientProfile = await db.clientProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });

  if (!clientProfile) {
    return {
      status: "error",
      code: "NOT_FOUND",
      message: "Client profile not found.",
    };
  }

  const review = await db.review.findUnique({
    where: { id: validated.reviewId },
    select: {
      id: true,
      clientProfileId: true,
      consultantProfileId: true,
      rating: true,
      isPublished: true,
      createdAt: true,
    },
  });

  if (!review) {
    return {
      status: "error",
      code: "NOT_FOUND",
      message: "Review not found.",
    };
  }

  if (review.clientProfileId !== clientProfile.id) {
    throw new AuthorizationError("You do not have access to edit this review.");
  }

  if (!isWithinReviewEditWindow(review.createdAt)) {
    return {
      status: "error",
      code: "EDIT_WINDOW_CLOSED",
      message: "The 48-hour editing window for this review has expired.",
    };
  }

  const ratingDiff = validated.rating - review.rating;

  await db.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: review.id },
      data: {
        rating: validated.rating,
        comment: validated.comment,
      },
    });

    // If review is currently published, update aggregate sum by difference
    if (review.isPublished && ratingDiff !== 0) {
      await tx.consultantProfile.update({
        where: { id: review.consultantProfileId },
        data: {
          ratingSum: { increment: ratingDiff },
        },
      });
    }
  });

  logger.info(
    { reviewId: review.id, oldRating: review.rating, newRating: validated.rating },
    "review updated",
  );

  return { status: "ok", reviewId: review.id };
}

/**
 * Admin action to unpublish/moderate an inappropriate review.
 * - Moderates review (isPublished = false, moderatedById = actor.id)
 * - Symmetrically decrements consultant ratingSum and ratingCount
 * - Writes an AuditLog entry (BR-13)
 */
export async function unpublishReview(
  actor: SessionUser,
  input: UnpublishReviewInput,
): Promise<ReviewMutationResult> {
  if (actor.role !== "ADMIN") {
    throw new AuthorizationError("Only administrators can moderate reviews.");
  }

  const validated = unpublishReviewSchema.parse(input);

  const review = await db.review.findUnique({
    where: { id: validated.reviewId },
    select: {
      id: true,
      consultantProfileId: true,
      rating: true,
      isPublished: true,
    },
  });

  if (!review) {
    return {
      status: "error",
      code: "NOT_FOUND",
      message: "Review not found.",
    };
  }

  // Idempotent check
  if (!review.isPublished) {
    return { status: "ok", reviewId: review.id };
  }

  await db.$transaction(async (tx) => {
    // Mark unpublished
    await tx.review.update({
      where: { id: review.id },
      data: {
        isPublished: false,
        moderatedById: actor.id,
      },
    });

    // Decrement aggregates symmetrically
    await tx.consultantProfile.update({
      where: { id: review.consultantProfileId },
      data: {
        ratingSum: { decrement: review.rating },
        ratingCount: { decrement: 1 },
      },
    });

    // Write audit log entry (BR-13)
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "REVIEW_UNPUBLISHED",
        entityType: "Review",
        entityId: review.id,
        metadata: { reason: validated.reason },
      },
    });
  });

  logger.info(
    { reviewId: review.id, adminId: actor.id, reason: validated.reason },
    "review unpublished by admin and aggregates decremented",
  );

  return { status: "ok", reviewId: review.id };
}
