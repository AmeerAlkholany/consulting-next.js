import "server-only";

import { redirect } from "next/navigation";
import { requireConsultant } from "@/server/authz/guards";
import { db } from "@/db/client";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingDisplay } from "@/features/reviews/rating-display";
import { ReviewList } from "@/features/reviews/review-list";
import { getConsultantReviews } from "@/server/dal/review";
import { Star, MessageSquare } from "lucide-react";

interface ConsultantReviewsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export const metadata = {
  title: "Client Reviews",
  description: "View and manage feedback from your consultation sessions.",
};

export default async function ConsultantReviewsPage({
  searchParams,
}: ConsultantReviewsPageProps) {
  const user = await requireConsultant({ approved: true });
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, parseInt(rawPage || "1", 10) || 1);

  const profile = await db.consultantProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      ratingSum: true,
      ratingCount: true,
    },
  });

  if (!profile) {
    redirect("/consultant/profile");
  }

  const { reviews, total, totalPages } = await getConsultantReviews(profile.id, {
    page,
    perPage: 10,
  });

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Client Reviews &amp; Feedback
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Reviews submitted by clients who attended completed consultations with you.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Rating Summary Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
              Aggregate Rating
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg text-center">
              <span className="text-4xl font-bold tracking-tight">
                {profile.ratingCount > 0
                  ? (profile.ratingSum / profile.ratingCount).toFixed(1)
                  : "—"}
              </span>
              <div className="mt-2">
                <RatingDisplay
                  ratingSum={profile.ratingSum}
                  ratingCount={profile.ratingCount}
                  size="lg"
                  showCount={false}
                />
              </div>
              <span className="text-xs text-muted-foreground mt-2">
                Based on {profile.ratingCount} published {profile.ratingCount === 1 ? "review" : "reviews"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Reviews List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              All Reviews ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewList
              reviews={reviews}
              total={total}
              page={page}
              totalPages={totalPages}
              emptyMessage="You have not received any client reviews yet. Reviews will appear here after clients complete consultations with you."
            />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
