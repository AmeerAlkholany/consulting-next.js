"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/feedback/error-state";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function ConsultantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Consultant workspace error", { digest: error.digest });
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState
        title="Could not load consultant workspace"
        description="We ran into a problem loading your workspace. You can retry or head back to your upcoming consultations."
        digest={error.digest}
        onRetry={reset}
        actions={
          <Link href="/consultant/appointments" className={cn(buttonVariants({ variant: "outline" }))}>
            View consultations
          </Link>
        }
      />
    </Container>
  );
}

