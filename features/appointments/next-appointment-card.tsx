import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/features/appointments/status-badge";
import type { ClientAppointmentRow } from "@/server/dal/appointment";
import { Calendar, Clock, Video, MapPin, ArrowRight } from "lucide-react";

interface NextAppointmentCardProps {
  appointment: ClientAppointmentRow | null;
  viewerTimezone: string;
}

export function NextAppointmentCard({ appointment, viewerTimezone }: NextAppointmentCardProps) {
  if (!appointment) {
    return (
      <Card className="border-dashed bg-card/60">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-semibold text-foreground">No upcoming appointments</h3>
            <p className="text-sm text-muted-foreground">
              Book a consultation with a verified specialist to get support.
            </p>
          </div>
          <Button asChild>
            <Link href="/consultants">Find a Consultant</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: viewerTimezone,
  }).format(startsAt);

  const formattedTime = `${new Intl.DateTimeFormat("en-US", {
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

  return (
    <Card className="border-primary/40 bg-card">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Next Consultation
          </span>
          <StatusBadge status={appointment.status} />
        </div>
        <CardTitle className="text-xl mt-1">{appointment.consultantFullName}</CardTitle>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {appointment.consultantHeadline}
        </p>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {formattedTime}{" "}
              <span className="text-xs text-muted-foreground">({viewerTimezone})</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {appointment.consultationType === "ONLINE" ? (
              <>
                <Video className="h-4 w-4 text-muted-foreground" />
                <span>Online Video Session</span>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>In-person Session</span>
              </>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-border/50 flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/appointments/${appointment.id}`}>
              Manage Appointment
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>

          {appointment.status === "CONFIRMED" && appointment.consultationType === "ONLINE" && (
            <Button size="sm">
              <Video className="h-4 w-4 mr-1.5" />
              Join Session
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
