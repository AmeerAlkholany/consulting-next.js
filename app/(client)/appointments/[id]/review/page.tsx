import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireClient } from "@/server/authz/guards";
import { db } from "@/db/client";
import { Container } from "@/components/layout/container";
import { ReviewForm } from "@/features/reviews/review-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isEligibleForReview, isWithinReviewEditWindow } from "@/schemas/review";
import { Star, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Review Consultation",
  description: "Share feedback on your completed psychological consultation session.",
};

export default async function AppointmentReviewPage({ params }: ReviewPageProps) {
  const { id: appointmentId } = await params;
  const user = await requireClient();

  const clientProfile = await db.clientProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!clientProfile) {
    redirect("/profile");
  }

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      clientProfileId: true,
      status: true,
      startsAt: true,
      endsAt: true,
      consultationType: true,
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          isPublished: true,
        },
      },
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

  if (!appointment) {
    notFound();
  }

  if (appointment.clientProfileId !== clientProfile.id) {
    notFound();
  }

  const consultantName = appointment.consultantProfile.user.fullName;

  // Case 1: Already reviewed
  if (appointment.review) {
    const existingReview = appointment.review;
    const canEdit = isWithinReviewEditWindow(existingReview.createdAt);

    if (canEdit) {
      return (
        <Container className="max-w-2xl py-8">
          <div className="mb-6">
            <Button asChild variant="ghost" size="sm" className="mb-2">
              <Link href={`/appointments/${appointment.id}` as unknown as "/appointments"}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Appointment
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Edit Your Review</h1>
            <p className="text-sm text-muted-foreground">
              You may update your rating or written feedback within 48 hours of original submission.
            </p>
          </div>

          <ReviewForm
            reviewId={existingReview.id}
            initialRating={existingReview.rating}
            initialComment={existingReview.comment}
            consultantName={consultantName}
            isEdit={true}
          />
        </Container>
      );
    }

    // Edit window expired
    return (
      <Container className="max-w-2xl py-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link href={`/appointments/${appointment.id}` as unknown as "/appointments"}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Appointment
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Your Review</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review Submitted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex text-yellow-500">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-5 w-5 ${
                      s <= existingReview.rating ? "fill-current" : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold">{existingReview.rating} of 5 stars</span>
            </div>

            {existingReview.comment && (
              <p className="text-sm text-muted-foreground bg-muted/40 p-4 rounded-lg">
                &ldquo;{existingReview.comment}&rdquo;
              </p>
            )}

            <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground border">
              This review is finalized. The 48-hour editing window has closed.
            </div>
          </CardContent>
        </Card>
      </Container>
    );
  }

  // Case 2: Check review eligibility
  const eligibility = isEligibleForReview(appointment);

  if (!eligibility.eligible) {
    return (
      <Container className="max-w-2xl py-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link href={`/appointments/${appointment.id}` as unknown as "/appointments"}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Appointment
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Review Unavailable</h1>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-sm">Cannot Review Appointment</h3>
            <p className="text-xs text-destructive/90">{eligibility.reason}</p>
          </div>
        </div>
      </Container>
    );
  }

  // Case 3: Eligible to review
  return (
    <Container className="max-w-2xl py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link href={`/appointments/${appointment.id}` as unknown as "/appointments"}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Appointment
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Leave a Review</h1>
        <p className="text-sm text-muted-foreground">
          Consultation with {consultantName}
        </p>
      </div>

      <ReviewForm
        appointmentId={appointment.id}
        consultantName={consultantName}
        isEdit={false}
      />
    </Container>
  );
}
