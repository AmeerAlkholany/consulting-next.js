import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/dal";
import { getAppointmentCounts, getClientAppointments } from "@/server/services/booking";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Star, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "My Appointments",
  description: "View and manage your upcoming and past appointments.",
};

export default async function ClientAppointmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const consultantProfile = await getConsultantProfile(user.id);
  const counts = await getAppointmentCounts(user);
  const appointments = await getClientAppointments(consultantProfile?.id ?? "", {
    limit: 10,
  });

  const statusConfig: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "success" | "outline";
      icon: typeof CheckCircle;
    }
  > = {
    PENDING: { label: "Pending", variant: "default", icon: Clock },
    CONFIRMED: { label: "Confirmed", variant: "success", icon: CheckCircle },
    COMPLETED: { label: "Completed", variant: "outline", icon: CheckCircle },
    CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
    NO_SHOW: { label: "No Show", variant: "destructive", icon: AlertCircle },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Appointments</h1>
          <p className="text-sm text-muted-foreground">
            {counts.upcoming} upcoming, {counts.completed} completed
          </p>
        </div>
        <Button asChild>
          <Link href="/consultants">Find a Consultant</Link>
        </Button>
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

      {/* Upcoming Appointments */}
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <div className="flex flex-col gap-3">
            {upcoming.map((apt) => {
              const config = statusConfig[apt.status] ?? {
                label: apt.status,
                variant: "default",
                icon: Clock,
              };
              const Icon = config.icon;
              return (
                <Card key={apt.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{apt.consultantHeadline}</span>
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
                        <form action={undefined}>
                          <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => {
                              if (confirm("Cancel this appointment?")) {
                                // Client-side cancel handler would go here
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </form>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Appointments */}
      {past.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Past</h2>
          <div className="flex flex-col gap-3">
            {past.map((apt) => {
              const config = statusConfig[apt.status] ?? {
                label: apt.status,
                variant: "default",
                icon: Clock,
              };
              const Icon = config.icon;
              return (
                <Card key={apt.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{apt.consultantHeadline}</span>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(apt.startsAt)}
                        </p>
                        {apt.review && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
                            <span className="text-sm">{apt.review.rating}.0</span>
                            {apt.review.comment && (
                              <span className="text-xs text-muted-foreground ml-2">
                                &ldquo;{apt.review.comment.slice(0, 50)}...&rdquo;
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {!apt.review && apt.status === "COMPLETED" && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/consultants/${apt.consultantProfileId}/review`}>
                          <Star className="h-4 w-4 mr-1" />
                          Leave Review
                        </a>
                      </Button>
                    )}
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
              Find a consultant to book your first session.
            </p>
            <Button asChild>
              <Link href="/consultants">Browse Consultants</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
