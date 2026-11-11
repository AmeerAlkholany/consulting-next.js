"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/feedback/error-state";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Directory error", { digest: error.digest });
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState
        title="Could not display directory"
        description="We couldn't load the consultant directory right now. Please try again or return to the directory home."
        digest={error.digest}
        onRetry={reset}
        actions={
          <Link href="/consultants" className={cn(buttonVariants({ variant: "outline" }))}>
            Browse Consultants
          </Link>
        }
      />
    </Container>
  );
}

