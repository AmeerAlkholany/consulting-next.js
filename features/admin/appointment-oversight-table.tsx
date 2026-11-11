"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { adminCancelAppointmentAction } from "./admin-actions";
import { AlertTriangle } from "lucide-react";
import type { AdminAppointmentOversightRow } from "@/server/dal/admin";

interface AppointmentOversightTableProps {
  appointments: AdminAppointmentOversightRow[];
}

export function AppointmentOversightTable({ appointments }: AppointmentOversightTableProps) {
  const [selectedAppointment, setSelectedAppointment] =
    useState<AdminAppointmentOversightRow | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCancelAppointment = () => {
    if (!selectedAppointment || reason.trim().length < 10) {
      setError("Please provide a cancellation reason (minimum 10 characters).");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await adminCancelAppointmentAction(selectedAppointment.id, reason.trim());
      if (!res.success) {
        setError(res.message || "Failed to cancel appointment");
        return;
      }
      setSelectedAppointment(null);
      setReason("");
    });
  };

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground">
              <th className="p-3 text-left font-medium">Session Time</th>
              <th className="p-3 text-left font-medium">Client</th>
              <th className="p-3 text-left font-medium">Consultant</th>
              <th className="p-3 text-left font-medium">Status</th>
              <th className="p-3 text-left font-medium">Fee</th>
              <th className="p-3 text-right font-medium">Intervention</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No appointments found matching current filters.
                </td>
              </tr>
            ) : (
              appointments.map((apt) => {
                const startsAt = new Date(apt.startsAt);
                const isCancellable = apt.status !== "CANCELLED" && apt.status !== "COMPLETED";

                return (
                  <tr key={apt.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-foreground">
                        {format(startsAt, "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(startsAt, "h:mm a")} ({apt.sessionDurationMinutes} min)
                      </div>
                    </td>
                    <td className="p-3 font-medium">{apt.clientDisplayName}</td>
                    <td className="p-3 font-medium">{apt.consultantFullName}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          apt.status === "CONFIRMED"
                            ? "default"
                            : apt.status === "COMPLETED"
                              ? "outline"
                              : apt.status === "CANCELLED"
                                ? "destructive"
                                : "secondary"
                        }
                        className="text-xs"
                      >
                        {apt.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs">
                      {(apt.priceMinor / 100).toFixed(2)} {apt.currency}
                    </td>
                    <td className="p-3 text-right">
                      {isCancellable ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 text-xs h-7"
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setError(null);
                          }}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          {apt.status === "CANCELLED"
                            ? `Cancelled by ${apt.cancelledBy || "system"}`
                            : "Resolved"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedAppointment && (
        <Dialog
          open={!!selectedAppointment}
          onOpenChange={(open) => {
            if (!open) setSelectedAppointment(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Administrative Appointment Cancellation
              </DialogTitle>
              <DialogDescription>
                You are cancelling the consultation between{" "}
                <span className="font-semibold text-foreground">
                  {selectedAppointment.clientDisplayName}
                </span>{" "}
                and{" "}
                <span className="font-semibold text-foreground">
                  {selectedAppointment.consultantFullName}
                </span>
                . An administrative audit log will be created.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-3 py-2">
              <label htmlFor="cancel-reason" className="text-sm font-medium">
                Mandatory Cancellation Reason (min 10 chars):
              </label>
              <Textarea
                id="cancel-reason"
                placeholder="e.g., Mandatory platform safety intervention, suspected fraudulent booking..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{reason.length}/500 characters</p>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setSelectedAppointment(null)}
                disabled={isPending}
              >
                Dismiss
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelAppointment}
                disabled={isPending || reason.trim().length < 10}
              >
                {isPending ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
