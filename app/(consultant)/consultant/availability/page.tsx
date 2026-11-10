import "server-only";

import { redirect } from "next/navigation";
import { requireConsultant } from "@/server/authz/guards";
import { getAllAvailabilityRules, getAllAvailabilityExceptions } from "@/server/dal/availability";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import { generateSlots } from "@/server/services/availability";
import { db } from "@/db/client";
import { Container } from "@/components/layout/container";
import { TimezoneNotice } from "@/features/availability/timezone-notice";
import { WeeklyGrid } from "@/features/availability/weekly-grid";
import { ExceptionCalendar } from "@/features/availability/exception-calendar";
import { SlotPreview } from "@/features/availability/slot-preview";

export const metadata = {
  title: "Availability Management",
  description: "Configure your weekly recurring hours, date exceptions, and slot generation.",
};

export default async function ConsultantAvailabilityPage() {
  const consultant = await requireConsultant({ approved: true });
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) {
    redirect("/consultant/profile");
  }

  const rules = await getAllAvailabilityRules(profile.id);
  const exceptions = await getAllAvailabilityExceptions(profile.id);

  // Compute 14-day live preview
  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const appointments = await db.appointment.findMany({
    where: {
      consultantProfileId: profile.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { gte: from, lte: to },
    },
    select: { startsAt: true, endsAt: true },
  });

  const preview = generateSlots({
    rules: rules.filter((r) => r.isActive),
    exceptions,
    appointments,
    bufferMinutes: profile.bufferMinutes,
    leadTimeMinutes: profile.minLeadTimeHours * 60,
    maxAdvanceMinutes: profile.maxAdvanceDays * 24 * 60,
    from,
    to,
    now,
    consultantTimezone: profile.timezone,
    sessionDurationMinutes: profile.sessionDurationMinutes,
  });

  const serializedRules = rules.map((r) => ({
    id: r.id,
    weekday: r.weekday,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    effectiveFrom: r.effectiveFrom ? r.effectiveFrom.toISOString() : null,
    effectiveUntil: r.effectiveUntil ? r.effectiveUntil.toISOString() : null,
    isActive: r.isActive,
  }));

  const serializedExceptions = exceptions.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    type: e.type,
    startMinute: e.startMinute,
    endMinute: e.endMinute,
    reason: e.reason,
  }));

  const serializedPreviewDays = preview.days.map((d) => ({
    date: d.date,
    slots: d.slots.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
    })),
  }));

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Availability Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your schedule, define weekly working hours, and review bookable slots.
        </p>
      </div>

      <TimezoneNotice timezone={profile.timezone} />

      <WeeklyGrid rules={serializedRules} />

      <ExceptionCalendar exceptions={serializedExceptions} />

      <SlotPreview timezone={profile.timezone} days={serializedPreviewDays} />
    </Container>
  );
}
