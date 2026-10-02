import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

/**
 * A labelled field with a hint and an error slot (ARCHITECTURE.md §6, composite
 * layer). Every form in the platform renders fields through this so that the
 * label/control/error wiring — `htmlFor`, `aria-describedby`, `role="alert"` —
 * is identical everywhere and cannot be forgotten per form.
 */

export interface FormFieldProps {
  /** Matches the control's `id` and is what the label points at. */
  id: string;
  label: string;
  /** Shown under the control until there is an error. */
  hint?: React.ReactNode;
  /** The server's or the form's message for this field. */
  error?: string;
  className?: string;
  children: React.ReactNode;
}

function FormField({ id, label, hint, error, className, children }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface FormMessageProps {
  tone: "error" | "success" | "info";
  children?: React.ReactNode;
  className?: string;
}

/**
 * The result of a submission, announced rather than merely shown: `role="alert"`
 * for a failure and a polite live region for a confirmation (ARCHITECTURE.md §30).
 */
function FormMessage({ tone, children, className }: FormMessageProps) {
  if (!children) {
    return null;
  }

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        tone === "error" && "border-danger/40 bg-danger/5 text-danger",
        tone === "success" && "border-success/40 bg-success/5 text-success",
        tone === "info" && "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

export { FormField, FormMessage };
