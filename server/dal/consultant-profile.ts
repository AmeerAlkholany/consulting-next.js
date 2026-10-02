import "server-only";

import { db } from "@/db/client";

export interface ConsultantProfileData {
  id: string;
  userId: string;
  slug: string;
  headline: string;
  bio: string;
  yearsOfExperience: number;
  sessionPriceMinor: number;
  currency: string;
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
  verificationStatus: string;
  rejectionReason: string | null;
  autoConfirmBookings: boolean;
  isAcceptingBookings: boolean;
  ratingSum: number;
  ratingCount: number;
  publishedAt: Date | null;
  specializationIds: string[];
  languageIds: string[];
}

export interface QualificationData {
  id: string;
  consultantProfileId: string;
  title: string;
  institution: string;
  awardedYear: number;
  credentialId: string | null;
  documentUrl: string | null;
  createdAt: Date;
}

/** Fetches the consultant profile for a given user. */
export async function getConsultantProfile(userId: string): Promise<ConsultantProfileData | null> {
  const profile = await db.consultantProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
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
      autoConfirmBookings: true,
      isAcceptingBookings: true,
      ratingSum: true,
      ratingCount: true,
      publishedAt: true,
      specializations: { select: { specializationId: true } },
      languages: { select: { languageId: true } },
    },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    userId: profile.userId,
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
    autoConfirmBookings: profile.autoConfirmBookings,
    isAcceptingBookings: profile.isAcceptingBookings,
    ratingSum: profile.ratingSum,
    ratingCount: profile.ratingCount,
    publishedAt: profile.publishedAt,
    specializationIds: profile.specializations.map((s) => s.specializationId),
    languageIds: profile.languages.map((l) => l.languageId),
  };
}

/** Fetches all qualifications for a consultant profile. */
export async function getQualifications(consultantProfileId: string): Promise<QualificationData[]> {
  return db.qualification.findMany({
    where: { consultantProfileId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      consultantProfileId: true,
      title: true,
      institution: true,
      awardedYear: true,
      credentialId: true,
      documentUrl: true,
      createdAt: true,
    },
  });
}

/** Fetches a consultant profile by slug (public view). */
export async function getConsultantProfileBySlug(slug: string): Promise<ConsultantProfileData | null> {
  const profile = await db.consultantProfile.findUnique({
    where: { slug },
    select: {
      id: true,
      userId: true,
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
      autoConfirmBookings: true,
      isAcceptingBookings: true,
      ratingSum: true,
      ratingCount: true,
      publishedAt: true,
      specializations: { select: { specializationId: true } },
      languages: { select: { languageId: true } },
    },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    userId: profile.userId,
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
    autoConfirmBookings: profile.autoConfirmBookings,
    isAcceptingBookings: profile.isAcceptingBookings,
    ratingSum: profile.ratingSum,
    ratingCount: profile.ratingCount,
    publishedAt: profile.publishedAt,
    specializationIds: profile.specializations.map((s) => s.specializationId),
    languageIds: profile.languages.map((l) => l.languageId),
  };
}