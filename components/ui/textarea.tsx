import * as React from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true, the field renders in its invalid state and wires up aria-invalid. */
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid = false, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || props["aria-invalid"] ? true : undefined}
        className={cn(
          "flex min-h-24 w-full rounded-md border border-border-strong bg-card px-3 py-2 text-sm text-foreground shadow-resting transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
