"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ConfirmDialogProps {
  /** A single element that opens the dialog, for example a `<Button>`. */
  trigger: React.ReactElement;
  /** Name the specific object being acted on. */
  title: string;
  /** State the consequence. Never a bare "Are you sure?". */
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "destructive" | "default";
  onConfirm: () => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Confirmation dialog for irreversible or high-consequence actions
 * (ARCHITECTURE.md §30). Stays open while an async `onConfirm` is in flight so
 * the outcome is never ambiguous.
 */
function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "destructive",
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  function handleOpenChange(next: boolean) {
    if (pending && !next) {
      return;
    }
    setOpen(next);
    onOpenChange?.(next);
  }

  async function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
      onOpenChange?.(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            aria-busy={pending}
            disabled={pending}
            onClick={handleConfirm}
            className={cn(
              buttonVariants({ variant: tone === "destructive" ? "destructive" : "default" }),
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ConfirmDialog };
