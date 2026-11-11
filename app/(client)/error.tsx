"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/feedback/error-state";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Client area error", { digest: error.digest });
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState
        title="Could not load your workspace"
        description="We ran into a problem loading this section. You can retry or head back to your client appointments."
        digest={error.digest}
        onRetry={reset}
        actions={
          <Link href="/appointments" className={cn(buttonVariants({ variant: "outline" }))}>
            View appointments
          </Link>
        }
      />
    </Container>
  );
}

