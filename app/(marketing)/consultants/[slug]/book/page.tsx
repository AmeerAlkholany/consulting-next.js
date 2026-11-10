import { getPublicConsultantBySlug } from "@/server/dal/consultant-search";
import { notFound } from "next/navigation";
import BookSlotPicker from "./book-slot-picker";
import { BookingConfirmation } from "@/features/booking/booking-confirmation";
import { Container } from "@/components/layout/container";

interface ConsultantBookPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    tz?: string;
    startsAt?: string;
    endsAt?: string;
  }>;
}

function getDefaultFrom(from?: string): string {
  return from ?? new Date().toISOString().split("T")[0];
}

function getDefaultTo(to?: string): string {
  return to ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function getDefaultTz(tz?: string): string {
  return tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export default async function ConsultantBookPage({
  params,
  searchParams,
}: ConsultantBookPageProps) {
  const { slug } = await params;
  const { from, to, tz, startsAt, endsAt } = await searchParams;

  // Verify consultant exists and is bookable
  const profile = await getPublicConsultantBySlug(slug);
  if (!profile || !profile.isAcceptingBookings) {
    notFound();
  }

  const defaultTz = getDefaultTz(tz);

  // If a slot has already been selected via URL params, show the confirmation screen directly
  if (startsAt && endsAt) {
    return (
      <Container className="py-8">
        <BookingConfirmation
          consultantProfileId={profile.id}
          consultantSlug={slug}
          consultantName={profile.fullName}
          consultantHeadline={profile.headline}
          startsAt={startsAt}
          endsAt={endsAt}
          durationMinutes={profile.sessionDurationMinutes}
          priceMinor={profile.sessionPriceMinor}
          currency={profile.currency}
          consultationTypes={profile.consultationTypes as Array<"ONLINE" | "IN_PERSON">}
          cancellationWindowHours={profile.cancellationWindowHours}
          autoConfirm={profile.autoConfirmBookings}
          consultantTimezone={profile.timezone}
          viewerTimezone={defaultTz}
        />
      </Container>
    );
  }

  const defaultFrom = getDefaultFrom(from);
  const defaultTo = getDefaultTo(to);

  return (
    <Container className="py-8">
      <BookSlotPicker
        slug={slug}
        consultantProfileId={profile.id}
        consultantName={profile.fullName}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
        defaultTz={defaultTz}
      />
    </Container>
  );
}
