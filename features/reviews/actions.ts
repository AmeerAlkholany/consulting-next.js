"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/dal";
import { AuthenticationError } from "@/server/errors";
import {
  createReview,
  updateReview,
  unpublishReview,
} from "@/server/services/reviews";
import {
  createReviewSchema,
  updateReviewSchema,
  unpublishReviewSchema,
} from "@/schemas/review";

export interface ReviewActionState {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  reviewId?: string;
}

export async function createReviewAction(
  _prevState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthenticationError("You must be logged in to submit a review.");
  }

  const rawData = {
    appointmentId: formData.get("appointmentId"),
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  };

  const parsed = createReviewSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the errors in the form.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await createReview(user, parsed.data);
    if (result.status === "error") {
      return {
        success: false,
        error: result.message,
      };
    }

    revalidatePath("/appointments");
    revalidatePath(`/appointments/${parsed.data.appointmentId}`);
    revalidatePath(`/appointments/${parsed.data.appointmentId}/review`);
    revalidatePath("/consultants");
    revalidatePath("/dashboard");

    return {
      success: true,
      reviewId: result.reviewId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function updateReviewAction(
  _prevState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthenticationError("You must be logged in to edit a review.");
  }

  const rawData = {
    reviewId: formData.get("reviewId"),
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  };

  const parsed = updateReviewSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the errors in the form.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await updateReview(user, parsed.data);
    if (result.status === "error") {
      return {
        success: false,
        error: result.message,
      };
    }

    revalidatePath("/appointments");
    revalidatePath("/consultants");
    revalidatePath("/dashboard");

    return {
      success: true,
      reviewId: result.reviewId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function unpublishReviewAction(
  _prevState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthenticationError("You must be logged in as an administrator.");
  }

  const rawData = {
    reviewId: formData.get("reviewId"),
    reason: formData.get("reason"),
  };

  const parsed = unpublishReviewSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please provide a valid reason for unpublishing.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await unpublishReview(user, parsed.data);
    if (result.status === "error") {
      return {
        success: false,
        error: result.message,
      };
    }

    revalidatePath("/consultants");
    revalidatePath("/admin");
    revalidatePath("/consultant/reviews");

    return {
      success: true,
      reviewId: result.reviewId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return {
      success: false,
      error: message,
    };
  }
}
