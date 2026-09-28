import * as React from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: React.ReactNode;
  /** Primary actions for the page, rendered to the right on wide screens. */
  actions?: React.ReactNode;
}

/**
 * One `h1` per page, followed by a short explanation and optional actions
 * (ARCHITECTURE.md §30 — accessibility strategy).
 */
function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <div className="max-w-measure text-base text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export { PageHeader };
