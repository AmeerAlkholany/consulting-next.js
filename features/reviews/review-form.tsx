"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RatingInput } from "./rating-input";
import { createReviewAction, updateReviewAction, type ReviewActionState } from "./actions";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface ReviewFormProps {
  appointmentId?: string;
  reviewId?: string;
  initialRating?: number;
  initialComment?: string | null;
  consultantName?: string;
  isEdit?: boolean;
}

const initialState: ReviewActionState = {
  success: false,
};

export function ReviewForm({
  appointmentId,
  reviewId,
  initialRating = 5,
  initialComment = "",
  consultantName,
  isEdit = false,
}: ReviewFormProps) {
  const router = useRouter();
  const [comment, setComment] = useState<string>(initialComment || "");
  const [rating, setRating] = useState<number>(initialRating);

  const action = isEdit ? updateReviewAction : createReviewAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card rounded-xl border text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-semibold">
          {isEdit ? "Review updated!" : "Thank you for your feedback!"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Your review has been successfully submitted. It helps other clients discover great
          consultants while keeping your identity private.
        </p>
        <div className="flex gap-3 pt-2">
          <Button
            variant="default"
            onClick={() => {
              if (appointmentId) {
                router.push(`/appointments/${appointmentId}` as unknown as "/appointments");
              } else {
                router.push("/appointments");
              }
            }}
          >
            Back to Appointment
          </Button>
          <Button variant="outline" onClick={() => router.push("/consultants")}>
            Browse Consultants
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6 bg-card p-6 rounded-xl border">
      {appointmentId && <input type="hidden" name="appointmentId" value={appointmentId} />}
      {reviewId && <input type="hidden" name="reviewId" value={reviewId} />}

      {isEdit && (
        <div className="flex items-center gap-2 p-3 text-xs bg-muted/50 border border-border rounded-lg text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Reviews can be edited within 48 hours of original creation.</span>
        </div>
      )}

      {state.error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-base font-semibold">
          {consultantName ? `Rate your session with ${consultantName}` : "Overall Rating"}
        </Label>
        <p className="text-xs text-muted-foreground">
          How would you describe the quality and professionalism of your consultation?
        </p>
        <RatingInput
          name="rating"
          defaultValue={initialRating}
          value={rating}
          onChange={setRating}
          disabled={isPending}
        />
        {state.fieldErrors?.rating && (
          <p className="text-xs text-destructive">{state.fieldErrors.rating[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="comment" className="text-sm font-semibold">
            Written Feedback (Optional)
          </Label>
          <span
            className={`text-xs ${
              comment.length > 2000 ? "text-destructive font-medium" : "text-muted-foreground"
            }`}
          >
            {comment.length} / 2000
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Your feedback will appear publicly as <strong>First Name + Last Initial</strong> (e.g.
          Jane D.). Never include private health information or clinical diagnoses in public
          reviews.
        </p>
        <Textarea
          id="comment"
          name="comment"
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this consultant to help others..."
          disabled={isPending}
          className="resize-y"
        />
        {state.fieldErrors?.comment && (
          <p className="text-xs text-destructive">{state.fieldErrors.comment[0]}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || comment.length > 2000}>
          {isPending ? "Submitting..." : isEdit ? "Save Changes" : "Submit Review"}
        </Button>
      </div>
    </form>
  );
}
