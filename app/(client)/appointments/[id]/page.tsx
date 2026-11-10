import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireClient } from "@/server/authz/guards";
import { getClientProfile } from "@/server/dal/client-profile";
import { getClientAppointmentById } from "@/server/dal/appointment";
import { AppointmentDetail } from "@/features/appointments/appointment-detail";
import { Container } from "@/components/layout/container";

interface AppointmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Appointment Details",
  description: "View and manage appointment details.",
};

export default async function AppointmentDetailPage({ params }: AppointmentDetailPageProps) {
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

  return (
    <Container className="py-8">
      <AppointmentDetail appointment={appointment} viewerTimezone={profile.timezone} />
    </Container>
  );
}

