import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireClient } from "@/server/authz/guards";
import { getClientProfile } from "@/server/dal/client-profile";
import { getClientAppointmentById } from "@/server/dal/appointment";
import { RescheduleFlow } from "@/features/booking/reschedule-flow";
import { Container } from "@/components/layout/container";

interface ReschedulePageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Reschedule Appointment",
  description: "Select a new date and time for your appointment.",
};

export default async function ReschedulePage({ params }: ReschedulePageProps) {
  const user = await requireClient();
  const profile = await getClientProfile(user.id);

  if (!profile) {
    redirect("/profile");
  }

  const { id } = await params;
  const appointment = await getClientAppointmentById(profile.id, id);

  if (!appointment) {
    notFound();
  }

  // Only PENDING or CONFIRMED appointments can be rescheduled
  if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
    redirect(`/appointments/${id}`);
  }

  return (
    <Container className="py-8">
      <RescheduleFlow
        appointmentId={appointment.id}
        consultantSlug={appointment.consultantSlug}
        consultantName={appointment.consultantFullName}
        currentStartsAt={appointment.startsAt.toISOString()}
        currentEndsAt={appointment.endsAt.toISOString()}
        consultantTimezone={appointment.consultantTimezone}
        viewerTimezone={profile.timezone}
      />
    </Container>
  );
}
