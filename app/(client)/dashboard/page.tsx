import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/dal";
import { getAppointmentCounts } from "@/server/services/booking";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Star, User } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Dashboard",
  description: "Your psychological consultation dashboard.",
};

export default async function ClientDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const counts = await getAppointmentCounts(user);

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {user.fullName}
        </h1>
        <p className="text-sm text-muted-foreground">Manage your appointments and profile.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Upcoming Appointments</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.upcoming}</p>
            <Button asChild variant="link" className="px-0 h-auto text-sm">
              <a href="/appointments">View all</a>
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
              <a href="/appointments?status=PENDING">View details</a>
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
              <a href="/appointments?status=COMPLETED">View history</a>
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
              <Link href="/consultants">Find a Consultant</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/appointments">My Appointments</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile">Edit Profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Timezone:</span>
              <span>{user.timezone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="capitalize">{user.status.toLowerCase()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
