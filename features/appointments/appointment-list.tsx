import Link from "next/link";
import { AppointmentRow } from "@/features/appointments/appointment-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
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
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No upcoming appointments"
          description="You don't have any consultations scheduled. Search verified consultants to book a session."
          action={
            <Button asChild>
              <Link href="/consultants">Find a Consultant</Link>
            </Button>
          }
        />
      );
    }

    if (tab === "past") {
      return (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="No past consultations"
          description="Completed sessions and past consultation history will appear here."
          action={
            <Button variant="outline" asChild>
              <Link href="/consultants">Book a new session</Link>
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        icon={<XCircle className="h-6 w-6" />}
        title="No cancelled appointments"
        description="You don't have any cancelled appointments."
      />
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

