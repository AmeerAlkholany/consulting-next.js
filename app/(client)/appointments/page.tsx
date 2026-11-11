import "server-only";

import { redirect } from "next/navigation";
import { requireClient } from "@/server/authz/guards";
import { getClientProfile } from "@/server/dal/client-profile";
import { getClientAppointmentsByTab, type AppointmentTab } from "@/server/dal/appointment";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { AppointmentTabs } from "@/features/appointments/appointment-tabs";
import { AppointmentList } from "@/features/appointments/appointment-list";
import Link from "next/link";

export const metadata = {
  title: "My Appointments",
  description: "View and manage your upcoming and past consultations.",
};

interface ClientAppointmentsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ClientAppointmentsPage({
  searchParams,
}: ClientAppointmentsPageProps) {
  const user = await requireClient();
  const profile = await getClientProfile(user.id);

  if (!profile) {
    redirect("/profile");
  }

  const { tab: rawTab } = await searchParams;
  const currentTab: AppointmentTab =
    rawTab === "past" || rawTab === "cancelled" ? rawTab : "upcoming";

  const now = new Date();

  // Load counts for all 3 tabs concurrently
  const [upcomingData, pastData, cancelledData] = await Promise.all([
    getClientAppointmentsByTab(profile.id, "upcoming", { limit: 1, now }),
    getClientAppointmentsByTab(profile.id, "past", { limit: 1, now }),
    getClientAppointmentsByTab(profile.id, "cancelled", { limit: 1, now }),
  ]);

  const counts = {
    upcoming: upcomingData.total,
    past: pastData.total,
    cancelled: cancelledData.total,
  };

  // Load active tab data (up to 50 records)
  const { appointments } = await getClientAppointmentsByTab(profile.id, currentTab, {
    limit: 50,
    now,
  });

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            My Consultations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your booked appointments, review past sessions, or find new support.
          </p>
        </div>
        <Button asChild>
          <Link href="/consultants">Book Consultation</Link>
        </Button>
      </div>

      <AppointmentTabs currentTab={currentTab} counts={counts} />

      <AppointmentList
        appointments={appointments}
        tab={currentTab}
        viewerTimezone={profile.timezone}
      />
    </Container>
  );
}
