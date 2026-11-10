import "server-only";

import { redirect } from "next/navigation";
import { requireConsultant } from "@/server/authz/guards";
import { getConsultantAppointments, getAppointmentCounts } from "@/server/services/booking";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, CheckCircle, AlertCircle } from "lucide-react";

export const metadata = {
  title: "My Appointments",
  description: "Manage your appointments and booking requests.",
};

export default async function ConsultantAppointmentsPage() {
  const consultant = await requireConsultant();
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) {
    redirect("/consultant/profile");
  }

  const counts = await getAppointmentCounts(consultant);
  const appointments = await getConsultantAppointments(profile.id, { limit: 20 });

  const statusConfig: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "success" | "outline" }
  > = {
    PENDING: { label: "Pending", variant: "default" },
    CONFIRMED: { label: "Confirmed", variant: "success" },
    COMPLETED: { label: "Completed", variant: "outline" },
    CANCELLED: { label: "Cancelled", variant: "destructive" },
    NO_SHOW: { label: "No Show", variant: "destructive" },
  };

  const upcoming = appointments.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED");
  const past = appointments.filter(
    (a) => a.status === "COMPLETED" || a.status === "CANCELLED" || a.status === "NO_SHOW",
  );

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(date));
  }

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Appointments</h1>
        <p className="text-sm text-muted-foreground">
          {counts.upcoming} upcoming, {counts.completed} completed
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.upcoming}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.completed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <div className="flex flex-col gap-3">
            {upcoming.map((apt) => {
              const config = statusConfig[apt.status] ?? { label: apt.status, variant: "default" };
              return (
                <Card key={apt.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{apt.clientDisplayName}</span>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(apt.startsAt)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {apt.consultationType} · {apt.priceMinor / 100} {apt.currency}
                        </p>
                        {apt.clientNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Note: {apt.clientNote}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {apt.status === "PENDING" && (
                        <>
                          <Badge variant="success" className="cursor-pointer">
                            Confirm
                          </Badge>
                          <Badge variant="destructive" className="cursor-pointer">
                            Decline
                          </Badge>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Past</h2>
          <div className="flex flex-col gap-3">
            {past.slice(0, 5).map((apt) => {
              const config = statusConfig[apt.status] ?? { label: apt.status, variant: "default" };
              return (
                <Card key={apt.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <CheckCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{apt.clientDisplayName}</span>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(apt.startsAt)}
                        </p>
                        {apt.review && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-muted-foreground">
                              Review: {apt.review.rating}/5
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {appointments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No appointments yet</p>
            <p className="text-muted-foreground text-center max-w-md">
              Your appointments will appear here once clients book with you.
            </p>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
