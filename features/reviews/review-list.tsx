"use client";

import { ReviewCard } from "./review-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export interface ReviewListItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  authorName: string;
  isPublished?: boolean;
}

interface ReviewListProps {
  reviews: ReviewListItem[];
  total: number;
  page: number;
  totalPages: number;
  isAdmin?: boolean;
  emptyMessage?: string;
}

export function ReviewList({
  reviews,
  total,
  page,
  totalPages,
  isAdmin = false,
  emptyMessage = "No reviews have been published for this consultant yet.",
}: ReviewListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-6 w-6" />}
        title="No reviews yet"
        description={emptyMessage}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {reviews.map((r) => (
          <ReviewCard
            key={r.id}
            id={r.id}
            rating={r.rating}
            comment={r.comment}
            createdAt={r.createdAt}
            authorName={r.authorName}
            isPublished={r.isPublished}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total} reviews
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
