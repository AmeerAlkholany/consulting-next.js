"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/features/appointments/status-badge";
import { ClientSummaryCard } from "./client-summary-card";
import { SessionNotesEditor, type SerializedNote } from "./session-notes-editor";
import {
  confirmAppointmentAction,
  declineAppointmentAction,
  markCompletedAction,
  markNoShowAction,
} from "./consultant-actions";
import {
  CalendarDays,
  ArrowLeft,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
} from "lucide-react";
import type { ConsultantAppointmentRow } from "@/server/dal/appointment";

interface ConsultantAppointmentDetailProps {
  appointment: ConsultantAppointmentRow;
  notes: SerializedNote[];
}

export function ConsultantAppointmentDetail({
  appointment,
  notes,
}: ConsultantAppointmentDetailProps) {
  const [error, setError] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);
  const now = new Date();

  const isFuture = startsAt > now;
  const isPastEnd = endsAt <= now;

  const canConfirm = appointment.status === "PENDING" && isFuture;
  const canDecline = appointment.status === "PENDING";
  const canComplete = appointment.status === "CONFIRMED" && isPastEnd;
  const canMarkNoShow = appointment.status === "CONFIRMED" && isPastEnd;

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await confirmAppointmentAction(appointment.id);
      if (!res.success) {
        setError(res.message || "Failed to confirm appointment");
      }
    });
  };

  const handleDecline = () => {
    if (!declineReason.trim()) {
      setError("Please provide a reason for declining.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await declineAppointmentAction(appointment.id, declineReason.trim());
      if (!res.success) {
        setError(res.message || "Failed to decline appointment");
      } else {
        setShowDeclineDialog(false);
      }
    });
  };

  const handleComplete = () => {
    setError(null);
    startTransition(async () => {
      const res = await markCompletedAction(appointment.id);
      if (!res.success) {
        setError(res.message || "Failed to mark as completed");
      }
    });
  };

  const handleNoShow = () => {
    if (!confirm("Are you sure you want to mark this client as a no-show?")) return;
    setError(null);
    startTransition(async () => {
      const res = await markNoShowAction(appointment.id);
      if (!res.success) {
        setError(res.message || "Failed to mark as no-show");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href="/consultant/appointments">
            <ArrowLeft className="h-4 w-4" />
            Back to appointments
          </Link>
        </Button>
        <StatusBadge status={appointment.status} />
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      {/* Action Bar */}
      {(canConfirm || canDecline || canComplete || canMarkNoShow) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium">Available Actions</p>
              <p className="text-xs text-muted-foreground">
                Manage appointment status according to consultation lifecycle rules.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canConfirm && (
                <Button
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isPending ? "Confirming..." : "Confirm Booking"}
                </Button>
              )}
              {canDecline && !showDeclineDialog && (
                <Button
                  variant="outline"
                  onClick={() => setShowDeclineDialog(true)}
                  disabled={isPending}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <XCircle className="h-4 w-4" />
                  Decline
                </Button>
              )}
              {canComplete && (
                <Button
                  onClick={handleComplete}
                  disabled={isPending}
                  className="gap-1.5"
                >
                  <UserCheck className="h-4 w-4" />
                  {isPending ? "Updating..." : "Mark Completed"}
                </Button>
              )}
              {canMarkNoShow && (
                <Button
                  variant="outline"
                  onClick={handleNoShow}
                  disabled={isPending}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <UserX className="h-4 w-4" />
                  {isPending ? "Updating..." : "Mark No-Show"}
                </Button>
              )}
            </div>
          </CardContent>
          {showDeclineDialog && (
            <div className="border-t p-4 bg-background/50 space-y-3">
              <label htmlFor="decline-reason" className="text-xs font-medium block">
                Reason for declining (shared with client):
              </label>
              <input
                id="decline-reason"
                type="text"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g., Unforeseen scheduling conflict, outside area of practice..."
                className="w-full text-sm p-2 border rounded-md"
                disabled={isPending}
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDeclineDialog(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDecline}
                  disabled={isPending || !declineReason.trim()}
                >
                  Confirm Decline
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Appointment Information */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Session Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Date & Time</span>
                  <p className="text-sm font-medium">
                    {format(startsAt, "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(startsAt, "h:mm a")} – {format(endsAt, "h:mm a")} ({appointment.consultantTimezone})
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Client Local Time</span>
                  <p className="text-sm font-medium">
                    {appointment.clientTimezone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Duration: {appointment.sessionDurationMinutes} minutes
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Session Type</span>
                  <p className="text-sm font-medium">
                    {appointment.consultationType === "ONLINE" ? "Online Video Session" : "In-Person"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Price</span>
                  <p className="text-sm font-medium flex items-center">
                    <DollarSign className="h-3.5 w-3.5" />
                    {(appointment.priceMinor / 100).toFixed(2)} {appointment.currency}
                  </p>
                </div>
              </div>

              {appointment.clientNote && (
                <div className="pt-3 border-t">
                  <span className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Client Note:
                  </span>
                  <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                    {appointment.clientNote}
                  </div>
                </div>
              )}

              {appointment.cancellationReason && (
                <div className="pt-3 border-t text-sm">
                  <span className="text-xs text-destructive font-medium block mb-1">
                    Cancellation Reason:
                  </span>
                  <p className="text-muted-foreground">{appointment.cancellationReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Notes Editor */}
          <SessionNotesEditor
            appointmentId={appointment.id}
            initialNotes={notes}
          />
        </div>

        <div>
          <ClientSummaryCard
            displayName={appointment.clientDisplayName}
            email={appointment.clientEmail}
            phoneNumber={appointment.clientPhone}
            status={appointment.status}
          />
        </div>
      </div>
    </div>
  );
}
