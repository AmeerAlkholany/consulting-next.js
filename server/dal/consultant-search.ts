import "server-only";

import { db } from "@/db/client";
import type { ConsultantSearchInput } from "@/schemas/consultant-search";

export interface PublicConsultantRow {
  id: string;
  slug: string;
  headline: string;
  userId: string;
  fullName: string;
  verificationStatus: string;
  isAcceptingBookings: boolean;
  specializations: Array<{ id: string; name: string }>;
  languages: Array<{ id: string; name: string }>;
  sessionPriceMinor: number;
  currency: string;
  sessionDurationMinutes: number;
  consultationTypes: string[];
  ratingSum: number;
  ratingCount: number;
  createdAt: Date;
}

export interface PublicConsultantDetailRow extends PublicConsultantRow {
  bio: string;
  yearsOfExperience: number;
  timezone: string;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  bufferMinutes: number;
  minLeadTimeHours: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
  autoConfirmBookings: boolean;
  qualifications: Array<{
    id: string;
    title: string;
    institution: string;
    awardedYear: number;
    credentialId: string | null;
  }>;
}

/** Fetches paginated approved consultants for public discovery. */
export async function searchConsultants(
  input: ConsultantSearchInput,
): Promise<{ consultants: PublicConsultantRow[]; total: number }> {
  const where: Record<string, unknown> = {
    verificationStatus: "APPROVED",
    user: { status: "ACTIVE", deletedAt: null },
  };

  if (input.q) {
    where.OR = [
      { headline: { contains: input.q, mode: "insensitive" } },
      { bio: { contains: input.q, mode: "insensitive" } },
      { user: { fullName: { contains: input.q, mode: "insensitive" } } },
    ];
  }

  if (input.specializationIds.length > 0) {
    where.specializations = { some: { specializationId: { in: input.specializationIds } } };
  }

  if (input.languageIds.length > 0) {
    where.languages = { some: { languageId: { in: input.languageIds } } };
  }

  if (input.consultationTypes.length > 0) {
    where.consultationTypes = { hasEvery: input.consultationTypes };
  }

  if (input.priceMin !== undefined || input.priceMax !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (input.priceMin !== undefined) priceFilter.gte = input.priceMin;
    if (input.priceMax !== undefined) priceFilter.lte = input.priceMax;
    where.sessionPriceMinor = priceFilter;
  }

  if (input.minRating !== undefined) {
    const minSum = input.minRating * 10 * (input.minRating === 5 ? 1 : 1);
    where.ratingSum = { gte: Math.ceil(minSum) };
    where.ratingCount = { gte: 1 };
  }

  if (input.availableWithinDays !== undefined) {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + input.availableWithinDays);
    where.availabilityRules = {
      some: {
        isActive: true,
        effectiveFrom: { lte: to },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: from } }],
      },
    };
  }

  const orderBy = getOrderBy(input.sort);

  const perPage = 12;
  const [consultants, total] = await Promise.all([
    db.consultantProfile.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        slug: true,
        headline: true,
        userId: true,
        verificationStatus: true,
        isAcceptingBookings: true,
        sessionPriceMinor: true,
        currency: true,
        sessionDurationMinutes: true,
        consultationTypes: true,
        ratingSum: true,
        ratingCount: true,
        createdAt: true,
        user: { select: { fullName: true } },
        specializations: { select: { specialization: { select: { id: true, name: true } } } },
        languages: { select: { language: { select: { id: true, name: true } } } },
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
      verificationStatus: c.verificationStatus,
      isAcceptingBookings: c.isAcceptingBookings,
      specializations: c.specializations.map((s) => ({ id: s.specialization.id, name: s.specialization.name })),
      languages: c.languages.map((l) => ({ id: l.language.id, name: l.language.name })),
      sessionPriceMinor: c.sessionPriceMinor,
      currency: c.currency,
      sessionDurationMinutes: c.sessionDurationMinutes,
      consultationTypes: c.consultationTypes,
      ratingSum: c.ratingSum,
      ratingCount: c.ratingCount,
      createdAt: c.createdAt,
    })),
    total,
  };
}

function getOrderBy(sort: ConsultantSearchInput["sort"]) {
  switch (sort) {
    case "price_asc":
      return [{ sessionPriceMinor: "asc" as const }, { createdAt: "desc" as const }];
    case "price_desc":
      return [{ sessionPriceMinor: "desc" as const }, { createdAt: "desc" as const }];
    case "rating":
      return [{ ratingCount: "desc" as const }, { ratingSum: "desc" as const }, { createdAt: "desc" as const }];
    default:
      return [{ createdAt: "desc" as const }];
  }
}

/** Fetches a public consultant profile by slug. */
export async function getPublicConsultantBySlug(slug: string): Promise<PublicConsultantDetailRow | null> {
  const profile = await db.consultantProfile.findUnique({
    where: { slug },
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
      isAcceptingBookings: true,
      autoConfirmBookings: true,
      ratingSum: true,
      ratingCount: true,
      createdAt: true,
      userId: true,
      user: { select: { fullName: true, status: true, deletedAt: true } },
      specializations: { select: { specialization: { select: { id: true, name: true } } } },
      languages: { select: { language: { select: { id: true, name: true } } } },
      qualifications: {
        select: { id: true, title: true, institution: true, awardedYear: true, credentialId: true },
      },
    },
  });

  if (!profile) return null;

  if (profile.verificationStatus !== "APPROVED" || profile.user.status !== "ACTIVE" || profile.user.deletedAt !== null) {
    return null;
  }

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
    isAcceptingBookings: profile.isAcceptingBookings,
    autoConfirmBookings: profile.autoConfirmBookings,
    ratingSum: profile.ratingSum,
    ratingCount: profile.ratingCount,
    createdAt: profile.createdAt,
    userId: profile.userId,
    fullName: profile.user.fullName,
    specializations: profile.specializations.map((s) => ({ id: s.specialization.id, name: s.specialization.name })),
    languages: profile.languages.map((l) => ({ id: l.language.id, name: l.language.name })),
    qualifications: profile.qualifications,
  };
}

/** Fetches up to 10 minimal consultant records for typeahead. */
export async function searchConsultantsTypeahead(q: string): Promise<Pick<PublicConsultantRow, "id" | "slug" | "headline" | "fullName">[]> {
  if (!q.trim()) return [];

  const consultants = await db.consultantProfile.findMany({
    where: {
      verificationStatus: "APPROVED",
      user: { status: "ACTIVE", deletedAt: null },
      OR: [
        { headline: { contains: q, mode: "insensitive" } },
        { bio: { contains: q, mode: "insensitive" } },
        { user: { fullName: { contains: q, mode: "insensitive" } } },
      ],
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      headline: true,
      user: { select: { fullName: true } },
    },
  });

  return consultants.map((c) => ({
    id: c.id,
    slug: c.slug,
    headline: c.headline,
    fullName: c.user.fullName,
  }));
}