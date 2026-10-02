import "server-only";

import { db } from "@/db/client";

export interface ConsultantListRow {
  id: string;
  slug: string;
  headline: string;
  userId: string;
  fullName: string;
  email: string;
  verificationStatus: string;
  rejectionReason: string | null;
  isAcceptingBookings: boolean;
  specializations: string[];
  languages: string[];
  sessionPriceMinor: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsultantDetailRow extends ConsultantListRow {
  bio: string;
  yearsOfExperience: number;
  sessionDurationMinutes: number;
  bufferMinutes: number;
  minLeadTimeHours: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
  consultationTypes: string[];
  addressLine: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  autoConfirmBookings: boolean;
  verificationReviewedAt: Date | null;
  verificationReviewedById: string | null;
  publishedAt: Date | null;
  ratingSum: number;
  ratingCount: number;
  qualifications: Array<{
    id: string;
    title: string;
    institution: string;
    awardedYear: number;
    credentialId: string | null;
  }>;
}

/** Fetches consultants with filters for admin review. */
export async function getConsultantsForAdmin(
  filter: { status: string; search: string; page: number; perPage: number },
): Promise<{ consultants: ConsultantListRow[]; total: number }> {
  const where: Record<string, unknown> = {};

  if (filter.status !== "ALL") {
    where.verificationStatus = filter.status;
  }

  if (filter.search) {
    where.OR = [
      { headline: { contains: filter.search, mode: "insensitive" } },
      { bio: { contains: filter.search, mode: "insensitive" } },
      { user: { fullName: { contains: filter.search, mode: "insensitive" } } },
      { user: { email: { contains: filter.search, mode: "insensitive" } } },
    ];
  }

  const [consultants, total] = await Promise.all([
    db.consultantProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.perPage,
      take: filter.perPage,
      select: {
        id: true,
        slug: true,
        headline: true,
        userId: true,
        verificationStatus: true,
        rejectionReason: true,
        isAcceptingBookings: true,
        sessionPriceMinor: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { fullName: true, email: true } },
        specializations: { select: { specialization: { select: { name: true } } } },
        languages: { select: { language: { select: { name: true } } } },
      },
    }),
    db.consultantProfile.count({ where }),
  ]);

  return {
    consultants: consultants.map((c) => ({
      id: c.id,
      slug: c.slug,
      headline: c.headline,
      userId: c.userId,
      fullName: c.user.fullName,
      email: c.user.email,
      verificationStatus: c.verificationStatus,
      rejectionReason: c.rejectionReason,
      isAcceptingBookings: c.isAcceptingBookings,
      specializations: c.specializations.map((s) => s.specialization.name),
      languages: c.languages.map((l) => l.language.name),
      sessionPriceMinor: c.sessionPriceMinor,
      currency: c.currency,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    total,
  };
}

/** Fetches a consultant profile with full details for admin review. */
export async function getConsultantDetailForAdmin(id: string): Promise<ConsultantDetailRow | null> {
  const profile = await db.consultantProfile.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      headline: true,
      bio: true,
      yearsOfExperience: true,
      sessionPriceMinor: true,
      currency: true,
      sessionDurationMinutes: true,
      bufferMinutes: true,
      minLeadTimeHours: true,
      maxAdvanceDays: true,
      cancellationWindowHours: true,
      consultationTypes: true,
      addressLine: true,
      city: true,
      country: true,
      timezone: true,
      verificationStatus: true,
      rejectionReason: true,
      isAcceptingBookings: true,
      autoConfirmBookings: true,
      verificationReviewedAt: true,
      verificationReviewedById: true,
      publishedAt: true,
      ratingSum: true,
      ratingCount: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      user: { select: { fullName: true, email: true } },
      specializations: { select: { specializationId: true } },
      languages: { select: { languageId: true } },
      qualifications: {
        select: { id: true, title: true, institution: true, awardedYear: true, credentialId: true },
      },
    },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    slug: profile.slug,
    headline: profile.headline,
    bio: profile.bio,
    yearsOfExperience: profile.yearsOfExperience,
    sessionPriceMinor: profile.sessionPriceMinor,
    currency: profile.currency,
    sessionDurationMinutes: profile.sessionDurationMinutes,
    bufferMinutes: profile.bufferMinutes,
    minLeadTimeHours: profile.minLeadTimeHours,
    maxAdvanceDays: profile.maxAdvanceDays,
    cancellationWindowHours: profile.cancellationWindowHours,
    consultationTypes: profile.consultationTypes,
    addressLine: profile.addressLine,
    city: profile.city,
    country: profile.country,
    timezone: profile.timezone,
    verificationStatus: profile.verificationStatus,
    rejectionReason: profile.rejectionReason,
    isAcceptingBookings: profile.isAcceptingBookings,
    autoConfirmBookings: profile.autoConfirmBookings,
    verificationReviewedAt: profile.verificationReviewedAt,
    verificationReviewedById: profile.verificationReviewedById,
    publishedAt: profile.publishedAt,
    ratingSum: profile.ratingSum,
    ratingCount: profile.ratingCount,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    userId: profile.userId,
    fullName: profile.user.fullName,
    email: profile.user.email,
    specializations: profile.specializations.map((s) => s.specializationId),
    languages: profile.languages.map((l) => l.languageId),
    qualifications: profile.qualifications,
  };
}