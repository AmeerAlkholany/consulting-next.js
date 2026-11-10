import "server-only";

import { redirect } from "next/navigation";
import Link from "next/link";
import { requireConsultant } from "@/server/authz/guards";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import {
  getConsultantAppointmentsByTab,
  type ConsultantAppointmentTab,
} from "@/server/dal/appointment";
import { Container } from "@/components/layout/container";
import { ConsultantSchedule } from "@/features/appointments/consultant-schedule";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = {
  title: "Consultant Schedule & Appointments",
  description: "Manage upcoming sessions, pending requests, and consultation history.",
};

interface PageProps {
  searchParams: Promise<{ tab?: string; page?: string }>;
}

export default async function ConsultantAppointmentsPage({ searchParams }: PageProps) {
  const consultant = await requireConsultant();
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) {
    redirect("/consultant/profile");
  }

  const { tab = "upcoming" } = await searchParams;
  const validTabs: ConsultantAppointmentTab[] = ["needs_response", "upcoming", "past", "cancelled"];
  const currentTab: ConsultantAppointmentTab = validTabs.includes(tab as ConsultantAppointmentTab)
    ? (tab as ConsultantAppointmentTab)
    : "upcoming";

  const { appointments } = await getConsultantAppointmentsByTab(profile.id, currentTab);

  return (
    <Container className="py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Appointment Schedule
        </h1>
        <p className="text-sm text-muted-foreground">
          View, manage, and complete consultation sessions.
        </p>
      </div>

      <div className="space-y-4">
        <Tabs value={currentTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full sm:w-[500px]">
            <TabsTrigger value="needs_response" asChild>
              <Link href="/consultant/appointments?tab=needs_response">
                Needs Response
              </Link>
            </TabsTrigger>
            <TabsTrigger value="upcoming" asChild>
              <Link href="/consultant/appointments?tab=upcoming">Upcoming</Link>
            </TabsTrigger>
            <TabsTrigger value="past" asChild>
              <Link href="/consultant/appointments?tab=past">Past</Link>
            </TabsTrigger>
            <TabsTrigger value="cancelled" asChild>
              <Link href="/consultant/appointments?tab=cancelled">Cancelled</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <ConsultantSchedule
          appointments={appointments}
          emptyMessage={
            currentTab === "needs_response"
              ? "No booking requests currently require a response."
              : currentTab === "upcoming"
                ? "No upcoming appointments scheduled."
                : currentTab === "past"
                  ? "No past appointments found."
                  : "No cancelled appointments."
          }
        />
      </div>
    </Container>
  );
}
