import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/**
 * Route-level `loading.tsx` skeletons that mirror the layout of the content
 * they replace, so nothing shifts when the data arrives (ARCHITECTURE.md §30).
 */
function LoadingRegion({
  label,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { label: string }) {
  return (
    <div role="status" aria-live="polite" className={className} {...props}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-border pb-6", className)}>
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-full max-w-measure" />
    </div>
  );
}

function CardListSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading results" className={cn("grid gap-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-6 shadow-resting">
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex w-full flex-col gap-2">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading form" className={cn("flex flex-col gap-6", className)}>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-11 w-40" />
    </LoadingRegion>
  );
}

function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading table" className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4"
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-6 w-24 rounded-full sm:ml-auto" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export { PageHeaderSkeleton, CardListSkeleton, FormSkeleton, TableSkeleton };
