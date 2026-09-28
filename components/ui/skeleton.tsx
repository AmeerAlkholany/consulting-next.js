import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Layout-matching placeholder used by route-level `loading.tsx` files and
 * Suspense fallbacks. Decorative only, so it is hidden from assistive tech.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
