import { z } from "zod";
import { BOOKING_POLICY } from "@/config/booking";

export const createReviewSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID"),
  rating: z.coerce.number().int().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars"),
  comment: z
    .string()
    .trim()
    .max(2000, "Comment cannot exceed 2000 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export const updateReviewSchema = z.object({
  reviewId: z.string().uuid("Invalid review ID"),
  rating: z.coerce.number().int().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars"),
  comment: z
    .string()
    .trim()
    .max(2000, "Comment cannot exceed 2000 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export const unpublishReviewSchema = z.object({
  reviewId: z.string().uuid("Invalid review ID"),
  reason: z.string().trim().min(3, "A moderation reason is required (at least 3 characters)").max(500, "Reason cannot exceed 500 characters"),
});

export const reviewFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateReviewInput = z.input<typeof createReviewSchema>;
export type UpdateReviewInput = z.input<typeof updateReviewSchema>;
export type UnpublishReviewInput = z.input<typeof unpublishReviewSchema>;
export type ReviewFilterInput = z.infer<typeof reviewFilterSchema>;

/**
 * Calculates a friendly display string for the average rating ("4.8" or "—").
 */
export function formatAverageRating(ratingSum: number, ratingCount: number): string {
  if (!ratingCount || ratingCount <= 0) return "—";
  return (ratingSum / ratingCount).toFixed(1);
}

/**
 * Anonymizes client identity for public reviews (BR-9 / ARCHITECTURE.md §17):
 * Displays first name plus last initial, e.g. "Jane Doe" -> "Jane D."
 * Never leaks account emails, UUIDs, or full last names.
 */
export function formatClientPublicName(fullNameOrDisplayName?: string | null): string {
  if (!fullNameOrDisplayName || !fullNameOrDisplayName.trim()) {
    return "Verified Client";
  }
  const parts = fullNameOrDisplayName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

/**
 * Checks whether a review is within the 48-hour edit window.
 */
export function isWithinReviewEditWindow(createdAt: Date, now: Date = new Date()): boolean {
  const windowMs = BOOKING_POLICY.reviewEditWindowHours * 60 * 60 * 1000;
  return now.getTime() - createdAt.getTime() <= windowMs;
}

/**
 * Checks whether an appointment is eligible for review under BR-9:
 * 1. Status must be COMPLETED
 * 2. Review window (default 30 days after endsAt) has not expired
 */
export function isEligibleForReview(
  appointment: { status: string; endsAt: Date },
  now: Date = new Date()
): { eligible: boolean; reason?: string } {
  if (appointment.status !== "COMPLETED") {
    return {
      eligible: false,
      reason: "Only completed appointments can be reviewed.",
    };
  }

  const windowMs = BOOKING_POLICY.reviewWindowDays * 24 * 60 * 60 * 1000;
  if (now.getTime() - appointment.endsAt.getTime() > windowMs) {
    return {
      eligible: false,
      reason: `The review window has closed (must be reviewed within ${BOOKING_POLICY.reviewWindowDays} days of completion).`,
    };
  }

  return { eligible: true };
}
