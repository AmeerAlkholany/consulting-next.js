import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireConsultant } from "@/server/authz/guards";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import { getConsultantAppointmentById } from "@/server/dal/appointment";
import { getAppointmentNotes } from "@/server/services/appointment-notes";
import { Container } from "@/components/layout/container";
import { ConsultantAppointmentDetail } from "@/features/appointments/consultant-appointment-detail";

export const metadata = {
  title: "Consultation Session Management",
  description: "Review appointment details, take clinical notes, and manage session status.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConsultantAppointmentDetailPage({ params }: PageProps) {
  const consultant = await requireConsultant();
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) {
    redirect("/consultant/profile");
  }

  const { id } = await params;
  const appointment = await getConsultantAppointmentById(profile.id, id);

  // Return 404 for unowned or nonexistent appointment (BR-10 IDOR protection)
  if (!appointment) {
    notFound();
  }

  const notes = await getAppointmentNotes(consultant, id);
  const serializedNotes = notes.map((n) => ({
    id: n.id,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));

  return (
    <Container className="py-8">
      <ConsultantAppointmentDetail appointment={appointment} notes={serializedNotes} />
    </Container>
  );
}
