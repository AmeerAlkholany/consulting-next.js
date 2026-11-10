import Link from "next/link";
import { AppointmentRow } from "@/features/appointments/appointment-row";
import { Button } from "@/components/ui/button";
import type { ClientAppointmentRow, AppointmentTab } from "@/server/dal/appointment";
import { Calendar, History, XCircle } from "lucide-react";

interface AppointmentListProps {
  appointments: ClientAppointmentRow[];
  tab: AppointmentTab;
  viewerTimezone: string;
}

export function AppointmentList({ appointments, tab, viewerTimezone }: AppointmentListProps) {
  if (appointments.length === 0) {
    if (tab === "upcoming") {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
          <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold text-foreground">No upcoming appointments</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-5">
            You don&apos;t have any consultations scheduled. Search verified consultants to book a session.
          </p>
          <Button asChild>
            <Link href="/consultants">Find a Consultant</Link>
          </Button>
        </div>
      );
    }

    if (tab === "past") {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
          <History className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold text-foreground">No past consultations</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Completed sessions and past consultation history will appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
        <XCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <h3 className="text-base font-semibold text-foreground">No cancelled appointments</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          You don&apos;t have any cancelled appointments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => (
        <AppointmentRow
          key={appointment.id}
          appointment={appointment}
          viewerTimezone={viewerTimezone}
        />
      ))}
    </div>
  );
}

