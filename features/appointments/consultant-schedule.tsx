import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { CalendarDays, Clock, User, ChevronRight } from "lucide-react";
import type { ConsultantAppointmentRow } from "@/server/dal/appointment";

interface ConsultantScheduleProps {
  appointments: ConsultantAppointmentRow[];
  emptyMessage?: string;
}

export function ConsultantSchedule({
  appointments,
  emptyMessage = "No appointments scheduled.",
}: ConsultantScheduleProps) {
  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 stroke-1 mb-3" />
          <p className="text-sm">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((apt) => {
        const startsAt = new Date(apt.startsAt);
        const endsAt = new Date(apt.endsAt);

        return (
          <Card key={apt.id} className="hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {apt.clientDisplayName}
                  </span>
                  <StatusBadge status={apt.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(startsAt, "EEE, MMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {format(startsAt, "h:mm a")} – {format(endsAt, "h:mm a")} (
                    {apt.consultantTimezone})
                  </span>
                  <span>{apt.sessionDurationMinutes} min</span>
                  <span>
                    {(apt.priceMinor / 100).toFixed(2)} {apt.currency}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button variant="outline" size="sm" asChild className="gap-1 text-xs">
                  <Link href={`/consultant/appointments/${apt.id}`}>
                    Manage
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
