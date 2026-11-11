import "server-only";

import { redirect } from "next/navigation";
import Link from "next/link";
import { requireConsultant } from "@/server/authz/guards";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import { getAppointmentCounts } from "@/server/services/booking";
import { getConsultantAppointmentsByTab } from "@/server/dal/appointment";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PendingRequests } from "@/features/appointments/pending-requests";
import { CalendarDays, Clock, Star, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Consultant Dashboard",
  description: "Manage your consultations, schedule, and client bookings.",
};

export default async function ConsultantDashboardPage() {
  const consultant = await requireConsultant();
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) {
    redirect("/consultant/profile");
  }

  const counts = await getAppointmentCounts(consultant);
  const pendingResult = await getConsultantAppointmentsByTab(profile.id, "needs_response", {
    limit: 5,
  });

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {consultant.fullName}
        </h1>
        <p className="text-sm text-muted-foreground">Manage your practice and appointments.</p>
      </div>

      {/* Pending Booking Requests Banner */}
      <PendingRequests requests={pendingResult.appointments} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Upcoming Schedule</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.upcoming}</p>
            <Button asChild variant="link" className="px-0 h-auto text-sm">
              <Link href="/consultant/appointments?tab=upcoming">View schedule</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.pending}</p>
            <Button asChild variant="link" className="px-0 h-auto text-sm">
              <Link href="/consultant/appointments?tab=needs_response">Review requests</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Completed</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.completed}</p>
            <Button asChild variant="link" className="px-0 h-auto text-sm">
              <Link href="/consultant/appointments?tab=past">View history</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" className="justify-between">
              <Link href="/consultant/availability">
                Manage Weekly Availability
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between">
              <Link href="/consultant/appointments">
                All Appointments
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between">
              <Link href="/consultant/profile">
                Edit Consultant Profile
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Verification:</span>
              <span className="font-medium capitalize">
                {profile.verificationStatus.toLowerCase()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Accepting Bookings:</span>
              <span className="font-medium">{profile.isAcceptingBookings ? "Yes" : "No"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rating:</span>
              <span className="font-medium">
                {profile.ratingCount > 0
                  ? (profile.ratingSum / profile.ratingCount).toFixed(1)
                  : "—"}{" "}
                ({profile.ratingCount} reviews)
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rate:</span>
              <span className="font-medium">
                {profile.sessionPriceMinor / 100} {profile.currency} /{" "}
                {profile.sessionDurationMinutes}min
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
