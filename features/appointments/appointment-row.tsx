import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/features/appointments/status-badge";
import { formatMoney } from "@/lib/money";
import type { ClientAppointmentRow } from "@/server/dal/appointment";
import { Calendar, Clock, Video, MapPin, ChevronRight, User } from "lucide-react";

interface AppointmentRowProps {
  appointment: ClientAppointmentRow;
  viewerTimezone: string;
}

export function AppointmentRow({ appointment, viewerTimezone }: AppointmentRowProps) {
  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
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
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <User className="h-4 w-4 text-primary" />
              {appointment.consultantFullName}
            </span>
            <StatusBadge status={appointment.status} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {appointment.consultationType === "ONLINE" ? (
                <>
                  <Video className="h-3 w-3" /> Online
                </>
              ) : (
                <>
                  <MapPin className="h-3 w-3" /> In-person
                </>
              )}
            </span>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-1">
            {appointment.consultantHeadline}
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-1">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formattedTime}
            </span>
            <span className="font-mono">
              {formatMoney(appointment.priceMinor, appointment.currency)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/appointments/${appointment.id}`}>
              View Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

