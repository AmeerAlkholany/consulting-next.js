"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/feedback/error-state";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin console error", { digest: error.digest });
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState
        title="Admin operation encountered an error"
        description="The requested administration view could not be rendered. You can retry or return to the admin overview."
        digest={error.digest}
        onRetry={reset}
        actions={
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
            Admin Overview
          </Link>
        }
      />
    </Container>
  );
}

