import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/features/appointments/status-badge";
import { CancelDialog } from "@/features/booking/cancel-dialog";
import { formatMoney } from "@/lib/money";
import type { ClientAppointmentRow } from "@/server/dal/appointment";
import {
  Calendar,
  Video,
  MapPin,
  Lock,
  ArrowLeft,
  CalendarSync,
  History,
  User,
  Star,
} from "lucide-react";

interface AppointmentDetailProps {
  appointment: ClientAppointmentRow;
  viewerTimezone: string;
}

export function AppointmentDetail({ appointment, viewerTimezone }: AppointmentDetailProps) {
  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: viewerTimezone,
  }).format(startsAt);

  const formattedViewerTime = `${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: viewerTimezone,
  }).format(startsAt)} – ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: viewerTimezone,
  }).format(endsAt)}`;

  const isDifferentTimezone = viewerTimezone !== appointment.consultantTimezone;
  const formattedConsultantTime = isDifferentTimezone
    ? `${new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: appointment.consultantTimezone,
      }).format(startsAt)} – ${new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: appointment.consultantTimezone,
      }).format(endsAt)}`
    : null;

  const canReschedule =
    appointment.status === "PENDING" || appointment.status === "CONFIRMED";
  const canCancel =
    appointment.status === "PENDING" || appointment.status === "CONFIRMED";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/appointments">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Appointments
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Appointment Details
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
            {appointment.consultantFullName}
          </h1>
          <p className="text-sm text-muted-foreground">{appointment.consultantHeadline}</p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>

      {/* Main Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">{formattedDate}</span>
                <p className="text-muted-foreground">{formattedViewerTime} ({viewerTimezone})</p>
                {formattedConsultantTime && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Consultant time: {formattedConsultantTime} ({appointment.consultantTimezone})
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              {appointment.consultationType === "ONLINE" ? (
                <Video className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              ) : (
                <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-semibold text-foreground">
                  {appointment.consultationType === "ONLINE" ? "Online Consultation" : "In-person Consultation"}
                </span>
                <p className="text-muted-foreground">{appointment.sessionDurationMinutes} minutes duration</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fee:</span>
            <span className="font-bold text-foreground font-mono text-base">
              {formatMoney(appointment.priceMinor, appointment.currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Client Note */}
      {appointment.clientNote && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              <span>Private Consultation Note</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground bg-muted/40 p-3 rounded-md border border-border/50">
              {appointment.clientNote}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status History & Lifecycle */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
            <History className="h-4 w-4" />
            <span>Timeline</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <div>
            Requested on: {new Date(appointment.createdAt).toLocaleString("en-US", { timeZone: viewerTimezone })}
          </div>
          {appointment.confirmedAt && (
            <div>
              Confirmed on: {new Date(appointment.confirmedAt).toLocaleString("en-US", { timeZone: viewerTimezone })}
            </div>
          )}
          {appointment.completedAt && (
            <div>
              Completed on: {new Date(appointment.completedAt).toLocaleString("en-US", { timeZone: viewerTimezone })}
            </div>
          )}
          {appointment.cancelledAt && (
            <div className="text-destructive">
              Cancelled on: {new Date(appointment.cancelledAt).toLocaleString("en-US", { timeZone: viewerTimezone })}
              {appointment.cancellationReason && (
                <span className="block mt-0.5">Reason: {appointment.cancellationReason}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permitted Actions */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <Button variant="outline" asChild>
          <Link href={`/consultants/${appointment.consultantSlug}`}>
            <User className="h-4 w-4 mr-1.5" />
            View Consultant Profile
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {canReschedule && (
            <Button variant="outline" asChild>
              <Link href={`/appointments/${appointment.id}/reschedule`}>
                <CalendarSync className="h-4 w-4 mr-1.5" />
                Reschedule
              </Link>
            </Button>
          )}

          {canCancel && (
            <CancelDialog
              appointmentId={appointment.id}
              startsAt={appointment.startsAt.toISOString()}
              cancellationWindowHours={appointment.cancellationWindowHours}
            />
          )}

          {appointment.status === "COMPLETED" && !appointment.review && (
            <Button asChild>
              <Link href={`/appointments/${appointment.id}/review` as unknown as "/appointments"}>
                <Star className="h-4 w-4 mr-1.5" />
                Leave Review
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

