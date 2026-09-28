import * as React from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Decorative icon, already sized by the caller (24–32px works best). */
  icon?: React.ReactNode;
  title: string;
  /** Explain what is missing and what the person can do next. */
  description: React.ReactNode;
  /** The next action, usually a link or a button. */
  action?: React.ReactNode;
}

/**
 * Empty is never a blank region (ARCHITECTURE.md §30): every list renders this
 * with an explanation and the next action.
 */
function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
      <p className="max-w-measure text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
