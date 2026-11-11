"use client";

import { useState } from "react";
import { Star, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { unpublishReviewAction } from "./actions";

interface ReviewCardProps {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  authorName: string;
  isPublished?: boolean;
  isAdmin?: boolean;
}

export function ReviewCard({
  id,
  rating,
  comment,
  createdAt,
  authorName,
  isPublished = true,
  isAdmin = false,
}: ReviewCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(createdAt));

  const handleUnpublish = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for unpublishing.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("reviewId", id);
      formData.set("reason", reason);
      const res = await unpublishReviewAction({ success: false }, formData);
      if (res.success) {
        setDialogOpen(false);
      } else {
        setError(res.error || "Failed to unpublish review.");
      }
    } catch {
      setError("Network or server error while unpublishing review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border bg-card text-card-foreground space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{authorName}</span>
            {!isPublished && (
              <Badge variant="destructive" className="text-xs">
                Unpublished / Moderated
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="flex items-center text-yellow-500"
              aria-label={`${rating} out of 5 stars`}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3.5 w-3.5 ${
                    star <= rating ? "fill-current" : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
          </div>
        </div>

        {isAdmin && isPublished && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 text-xs h-7 px-2"
              >
                <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                Unpublish
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Unpublish Review</DialogTitle>
                <DialogDescription>
                  This review will be removed from public view and the consultant&apos;s rating
                  aggregates will be decremented accordingly. This action is audited.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label htmlFor="unpublish-reason" className="text-sm font-medium">
                  Moderation Reason (Required)
                </Label>
                <Textarea
                  id="unpublish-reason"
                  placeholder="e.g. Inappropriate language, disclosure of private health details..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleUnpublish} disabled={isSubmitting}>
                  {isSubmitting ? "Unpublishing..." : "Confirm Unpublish"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {comment ? (
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{comment}</p>
      ) : (
        <p className="text-xs text-muted-foreground italic">No written comment provided.</p>
      )}
    </div>
  );
}
