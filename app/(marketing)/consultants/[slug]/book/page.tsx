import { getPublicConsultantBySlug } from "@/server/dal/consultant-search";
import { notFound } from "next/navigation";
import BookSlotPicker from "./book-slot-picker";

interface ConsultantBookPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; to?: string; tz?: string }>;
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
  const { from, to, tz } = await searchParams;

  // Verify consultant exists and is bookable
  const profile = await getPublicConsultantBySlug(slug);
  if (!profile) {
    notFound();
  }

  const defaultFrom = getDefaultFrom(from);
  const defaultTo = getDefaultTo(to);
  const defaultTz = getDefaultTz(tz);

  return (
    <BookSlotPicker
      slug={slug}
      consultantName={profile.fullName}
      defaultFrom={defaultFrom}
      defaultTo={defaultTo}
      defaultTz={defaultTz}
    />
  );
}
