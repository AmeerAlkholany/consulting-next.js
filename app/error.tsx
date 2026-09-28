"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/feedback/error-state";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // The digest is the key that matches this failure to the server-side log.
    console.error("Route error", { digest: error.digest });
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState
        title="Something went wrong on this page"
        description="The page could not be loaded. You can try again, or go back to the home page. If it keeps happening, contact support and mention the reference code below."
        digest={error.digest}
        onRetry={retry}
        actions={
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Go to the home page
          </Link>
        }
      />
    </Container>
  );
}
