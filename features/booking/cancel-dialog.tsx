"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelAppointmentAction } from "@/features/booking/actions";
import { initialAuthFormState, type AuthFormState } from "@/features/auth/form-state";
import { AlertTriangle, AlertCircle, Loader2 } from "lucide-react";

interface CancelDialogProps {
  appointmentId: string;
  startsAt: string;
  cancellationWindowHours?: number;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function CancelDialog({
  appointmentId,
  startsAt,
  cancellationWindowHours = 24,
  trigger,
  onSuccess,
}: CancelDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AuthFormState>(initialAuthFormState);
  const [reason, setReason] = useState("");
  const [isWithinCancellationWindow, setIsWithinCancellationWindow] = useState(true);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const startsAtDate = new Date(startsAt);
      const hoursUntilStart = (startsAtDate.getTime() - Date.now()) / (1000 * 60 * 60);
      setIsWithinCancellationWindow(hoursUntilStart >= cancellationWindowHours);
    }
    setOpen(nextOpen);
  };

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    setState(initialAuthFormState);

    const formData = new FormData();
    formData.set("appointmentId", appointmentId);
    if (reason.trim()) formData.set("reason", reason.trim());

    startTransition(async () => {
      const result = await cancelAppointmentAction(initialAuthFormState, formData);
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="destructive" size="sm">
            Cancel Appointment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Cancel Appointment</DialogTitle>
          </div>
          <DialogDescription>
            {isWithinCancellationWindow
              ? `You are cancelling with more than ${cancellationWindowHours} hours notice. This will immediately free the slot.`
              : `Warning: This appointment is scheduled in less than ${cancellationWindowHours} hours. Cancellation may be subject to the consultant's short-notice policy.`}
          </DialogDescription>
        </DialogHeader>

        {state.status === "error" && state.message && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{state.message}</p>
          </div>
        )}

        <form onSubmit={handleCancel} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancelReason">Reason for Cancellation (Optional)</Label>
            <Textarea
              id="cancelReason"
              placeholder="Please let the consultant know why you need to cancel..."
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Keep Appointment
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling...
                </span>
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

