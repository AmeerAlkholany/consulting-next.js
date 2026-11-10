import "server-only";

import { redirect } from "next/navigation";
import { requireClient } from "@/server/authz/guards";
import { getClientProfile } from "@/server/dal/client-profile";
import {
  getNextClientAppointment,
  getClientAppointmentsByTab,
} from "@/server/dal/appointment";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NextAppointmentCard } from "@/features/appointments/next-appointment-card";
import { CalendarDays, Clock, CheckCircle2, User, Sparkles } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Client Dashboard",
  description: "Overview of your psychological consultation appointments and account.",
};

export default async function ClientDashboardPage() {
  const user = await requireClient();
  const profile = await getClientProfile(user.id);

  if (!profile) {
    redirect("/profile");
  }

  const now = new Date();

  // Load next appointment and counts in parallel
  const [nextAppointment, upcomingData, pastData, pendingData] = await Promise.all([
    getNextClientAppointment(profile.id, now),
    getClientAppointmentsByTab(profile.id, "upcoming", { limit: 1, now }),
    getClientAppointmentsByTab(profile.id, "past", { limit: 1, now }),
    // Pending requests specifically
    getClientAppointmentsByTab(profile.id, "upcoming", { limit: 50, now }),
  ]);

  const pendingCount = pendingData.appointments.filter((a) => a.status === "PENDING").length;

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {profile.displayName || user.fullName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here is your consultation schedule and upcoming appointments.
        </p>
      </div>

      {/* Next Appointment Hero Card */}
      <NextAppointmentCard appointment={nextAppointment} viewerTimezone={profile.timezone} />

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upcoming Sessions
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{upcomingData.total}</p>
            <Button asChild variant="link" className="px-0 h-auto text-xs mt-1">
              <Link href="/appointments?tab=upcoming">View upcoming</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Confirmation
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingCount}</p>
            <Button asChild variant="link" className="px-0 h-auto text-xs mt-1">
              <Link href="/appointments?tab=upcoming">Review pending</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed Consultations
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pastData.total}</p>
            <Button asChild variant="link" className="px-0 h-auto text-xs mt-1">
              <Link href="/appointments?tab=past">View past sessions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="default">
              <Link href="/consultants">Find a Consultant</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/appointments">My Consultations</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile">Edit Profile &amp; Settings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium text-foreground">{user.email}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Timezone:</span>
              <span className="font-medium text-foreground">{profile.timezone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Status:</span>
              <span className="capitalize font-medium text-success">
                {user.status.toLowerCase()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
