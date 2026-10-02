import Link from "next/link";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * 403 Forbidden page (IMPLEMENTATION.md Step 5).
 *
 * Rendered when a user attempts to access a resource they do not have permission
 * for, or when `forbidden()` is thrown from a route segment.
 */
export default function ForbiddenPage() {
  return (
    <Container className="flex flex-col gap-6 py-20">
      <p className="text-sm font-medium uppercase tracking-wide text-primary">403</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Forbidden
      </h1>
      <p className="max-w-measure text-base text-muted-foreground">
        You don&apos;t have permission to access this page. If you believe this is an
        error, please contact support.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={cn(buttonVariants())}>
          Go to the home page
        </Link>
      </div>
    </Container>
  );
}
