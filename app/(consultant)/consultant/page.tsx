import "server-only";

import { redirect } from "next/navigation";
import { requireConsultant } from "@/server/authz/guards";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import { getAppointmentCounts } from "@/server/services/booking";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Star } from "lucide-react";

export const metadata = {
  title: "Consultant Dashboard",
  description: "Manage your consultations and availability.",
};

export default async function ConsultantDashboardPage() {
  const consultant = await requireConsultant();
  const profile = await getConsultantProfile(consultant.id);
  const counts = await getAppointmentCounts(consultant);

  if (!profile) {
    redirect("/consultant/profile");
  }

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {consultant.fullName}
        </h1>
        <p className="text-sm text-muted-foreground">Manage your practice and appointments.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Today&apos;s Schedule</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.upcoming}</p>
            <Button asChild variant="link" className="px-0 h-auto text-sm">
              <a href="/consultant/appointments">View schedule</a>
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
              <a href="/consultant/appointments?status=PENDING">Review requests</a>
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
              <a href="/consultant/appointments?status=COMPLETED">View history</a>
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
            <Button asChild variant="outline">
              <a href="/consultant/availability">Manage Availability</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/consultant/appointments">My Appointments</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/consultant/profile">Edit Profile</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="capitalize">{profile.verificationStatus.toLowerCase()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Accepting Bookings:</span>
              <span className="capitalize">{profile.isAcceptingBookings ? "Yes" : "No"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Rating:</span>
              <span>
                {profile.ratingCount > 0
                  ? (profile.ratingSum / (profile.ratingCount * 10)).toFixed(1)
                  : "—"}{" "}
                ({profile.ratingCount} reviews)
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Price:</span>
              <span>
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
