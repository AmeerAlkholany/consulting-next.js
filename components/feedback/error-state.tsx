import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** What happened, in plain words, and what the person can do next. */
  description: React.ReactNode;
  /**
   * The digest from a Next.js error boundary. Only this value may be shown —
   * never a raw `error.message`, which can leak internals.
   */
  digest?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions, such as a link home. */
  actions?: React.ReactNode;
}

function ErrorState({
  title,
  description,
  digest,
  onRetry,
  retryLabel = "Try again",
  actions,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-6 shadow-resting",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
        <p className="max-w-measure text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {onRetry ? <Button onClick={onRetry}>{retryLabel}</Button> : null}
        {actions}
      </div>
      {digest ? (
        <p className="text-xs text-muted-foreground">
          Reference code: <span className="font-mono">{digest}</span>
        </p>
      ) : null}
    </div>
  );
}

export { ErrorState };
