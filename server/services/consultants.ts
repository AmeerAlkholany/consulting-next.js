import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { AuthorizationError, NotFoundError } from "@/server/errors";
import { writeAuditLog, type AuditContext } from "./audit";
import { generateSlug } from "@/schemas/consultant-profile";
import { getConsultantProfile, getQualifications, type ConsultantProfileData, type QualificationData } from "@/server/dal/consultant-profile";
import type { ConsultantProfileInput, QualificationInput, PricingPolicyInput, SetSpecializationsInput, SetLanguagesInput } from "@/schemas/consultant-profile";

/**
 * Consultant profile service (IMPLEMENTATION.md Step 8).
 *
 * All mutations accept the actor directly — never an id from the payload —
 * so Consultant A cannot modify Consultant B's profile.
 * Fields `verificationStatus`, `publishedAt`, `ratingSum`, `ratingCount` are
 * never exposed in input schemas and cannot be set by the consultant.
 */

export interface CompletenessResult {
  isComplete: boolean;
  missing: string[];
}

export interface SubmitResult {
  status: "ok";
  profile: ConsultantProfileData;
}

export interface NotCompleteResult {
  status: "not_complete";
  missing: string[];
}

/** Checks whether a profile is complete enough to submit for verification. */
export function checkCompleteness(profile: ConsultantProfileData): CompletenessResult {
  const missing: string[] = [];

  if (!profile.headline || profile.headline.length < 10) missing.push("Headline (10–120 characters)");
  if (!profile.bio || profile.bio.length < 50) missing.push("Biography (50–4000 characters)");
  if (profile.yearsOfExperience === undefined) missing.push("Years of experience");
  if (!profile.sessionPriceMinor || profile.sessionPriceMinor <= 0) missing.push("Session price");
  if (!profile.currency) missing.push("Currency");
  if (!validSessionDurations.includes(profile.sessionDurationMinutes as (typeof validSessionDurations)[0])) missing.push("Session duration");
  if (profile.consultationTypes.length === 0) missing.push("At least one consultation type");
  if (profile.consultationTypes.includes("IN_PERSON") && (!profile.addressLine || !profile.city || !profile.country)) {
    missing.push("Address (required for in-person consultations)");
  }
  if (profile.specializationIds.length === 0) missing.push("At least one specialization");
  if (profile.languageIds.length === 0) missing.push("At least one language");

  return { isComplete: missing.length === 0, missing };
}

const validSessionDurations = [30, 45, 50, 60, 90] as const;

/** Updates the consultant's professional profile (content fields). */
export async function updateConsultantProfile(
  actor: { id: string },
  input: ConsultantProfileInput,
): Promise<SubmitResult | NotFoundError> {
  const profile = await getConsultantProfile(actor.id);
  if (!profile) throw new NotFoundError("Consultant profile not found.");

  const updated = await db.$transaction(async (tx) => {
    await tx.consultantProfile.update({
      where: { userId: actor.id },
      data: {
        headline: input.headline,
        bio: input.bio,
        yearsOfExperience: input.yearsOfExperience,
        sessionPriceMinor: input.sessionPriceMinor,
        currency: input.currency,
        sessionDurationMinutes: input.sessionDurationMinutes,
        bufferMinutes: input.bufferMinutes,
        minLeadTimeHours: input.minLeadTimeHours,
        maxAdvanceDays: input.maxAdvanceDays,
        cancellationWindowHours: input.cancellationWindowHours,
        consultationTypes: input.consultationTypes,
        addressLine: input.addressLine,
        city: input.city,
        country: input.country,
        timezone: input.timezone,
        autoConfirmBookings: input.autoConfirmBookings,
        isAcceptingBookings: input.isAcceptingBookings,
      },
    });

    // Replace specializations atomically.
    await tx.consultantSpecialization.deleteMany({ where: { consultantProfileId: profile.id } });
    if (input.specializationIds.length > 0) {
      await tx.consultantSpecialization.createMany({
        data: input.specializationIds.map((specializationId) => ({
          consultantProfileId: profile.id,
          specializationId,
        })),
      });
    }

    // Replace languages atomically.
    await tx.consultantLanguage.deleteMany({ where: { consultantProfileId: profile.id } });
    if (input.languageIds.length > 0) {
      await tx.consultantLanguage.createMany({
        data: input.languageIds.map((languageId) => ({
          consultantProfileId: profile.id,
          languageId,
        })),
      });
    }

    return tx.consultantProfile.findUnique({
      where: { userId: actor.id },
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
  });

  if (!updated) throw new NotFoundError("Consultant profile not found after update.");

  return {
    status: "ok",
    profile: {
      id: updated.id,
      userId: updated.userId,
      slug: updated.slug,
      headline: updated.headline,
      bio: updated.bio,
      yearsOfExperience: updated.yearsOfExperience,
      sessionPriceMinor: updated.sessionPriceMinor,
      currency: updated.currency,
      sessionDurationMinutes: updated.sessionDurationMinutes,
      bufferMinutes: updated.bufferMinutes,
      minLeadTimeHours: updated.minLeadTimeHours,
      maxAdvanceDays: updated.maxAdvanceDays,
      cancellationWindowHours: updated.cancellationWindowHours,
      consultationTypes: updated.consultationTypes,
      addressLine: updated.addressLine,
      city: updated.city,
      country: updated.country,
      timezone: updated.timezone,
      verificationStatus: updated.verificationStatus,
      rejectionReason: updated.rejectionReason,
      autoConfirmBookings: updated.autoConfirmBookings,
      isAcceptingBookings: updated.isAcceptingBookings,
      ratingSum: updated.ratingSum,
      ratingCount: updated.ratingCount,
      publishedAt: updated.publishedAt,
      specializationIds: updated.specializations.map((s) => s.specializationId),
      languageIds: updated.languages.map((l) => l.languageId),
    },
  };
}

/** Upserts a qualification (create or update). */
export async function upsertQualification(
  actor: { id: string },
  input: QualificationInput,
): Promise<QualificationData> {
  const profile = await getConsultantProfile(actor.id);
  if (!profile) throw new AuthorizationError("Consultant profile not found.");

  const qualification = input.id
    ? await db.qualification.update({
        where: { id: input.id, consultantProfileId: profile.id },
        data: {
          title: input.title,
          institution: input.institution,
          awardedYear: input.awardedYear,
          credentialId: input.credentialId ?? null,
          documentUrl: input.documentUrl ?? null,
        },
      })
    : await db.qualification.create({
        data: {
          consultantProfileId: profile.id,
          title: input.title,
          institution: input.institution,
          awardedYear: input.awardedYear,
          credentialId: input.credentialId ?? null,
          documentUrl: input.documentUrl ?? null,
        },
      });

  return qualification;
}

/** Deletes a qualification. */
export async function deleteQualification(actor: { id: string }, qualificationId: string): Promise<void> {
  const profile = await getConsultantProfile(actor.id);
  if (!profile) throw new AuthorizationError("Consultant profile not found.");

  await db.qualification.deleteMany({
    where: { id: qualificationId, consultantProfileId: profile.id },
  });
}

/** Replaces the consultant's specialization set. */
export async function setSpecializations(
  actor: { id: string },
  input: SetSpecializationsInput,
): Promise<{ status: "ok" }> {
  const profile = await getConsultantProfile(actor.id);
  if (!profile) throw new AuthorizationError("Consultant profile not found.");

  // Verify all specializations are active.
  const activeCount = await db.specialization.count({
    where: { id: { in: input.specializationIds }, isActive: true },
  });

  if (activeCount !== input.specializationIds.length) {
    throw new AuthorizationError("One or more selected specializations are not active.");
  }

  await db.$transaction(async (tx) => {
    await tx.consultantSpecialization.deleteMany({ where: { consultantProfileId: profile.id } });
    await tx.consultantSpecialization.createMany({
      data: input.specializationIds.map((specializationId) => ({
        consultantProfileId: profile.id,
        specializationId,
      })),
    });
  });

  return { status: "ok" };
}

/** Replaces the consultant's language set. */
export async function setLanguages(
  actor: { id: string },
  input: SetLanguagesInput,
): Promise<{ status: "ok" }> {
  const profile = await getConsultantProfile(actor.id);
  if (!profile) throw new AuthorizationError("Consultant profile not found.");

  await db.$transaction(async (tx) => {
    await tx.consultantLanguage.deleteMany({ where: { consultantProfileId: profile.id } });
    await tx.consultantLanguage.createMany({
      data: input.languageIds.map((languageId) => ({
        consultantProfileId: profile.id,
        languageId,
      })),
    });
  });

  return { status: "ok" };
}

/** Updates the pricing and policy section. */
export async function updatePricingPolicy(
  actor: { id: string },
  input: PricingPolicyInput,
): Promise<SubmitResult> {
  const profile = await getConsultantProfile(actor.id);
  if (!profile) throw new AuthorizationError("Consultant profile not found.");

  const updated = await db.consultantProfile.update({
    where: { userId: actor.id },
    data: {
      sessionPriceMinor: input.sessionPriceMinor,
      currency: input.currency,
      sessionDurationMinutes: input.sessionDurationMinutes,
      bufferMinutes: input.bufferMinutes,
      minLeadTimeHours: input.minLeadTimeHours,
      maxAdvanceDays: input.maxAdvanceDays,
      cancellationWindowHours: input.cancellationWindowHours,
      autoConfirmBookings: input.autoConfirmBookings,
      isAcceptingBookings: input.isAcceptingBookings,
    },
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

  return {
    status: "ok",
    profile: {
      id: updated.id,
      userId: updated.userId,
      slug: updated.slug,
      headline: updated.headline,
      bio: updated.bio,
      yearsOfExperience: updated.yearsOfExperience,
      sessionPriceMinor: updated.sessionPriceMinor,
      currency: updated.currency,
      sessionDurationMinutes: updated.sessionDurationMinutes,
      bufferMinutes: updated.bufferMinutes,
      minLeadTimeHours: updated.minLeadTimeHours,
      maxAdvanceDays: updated.maxAdvanceDays,
      cancellationWindowHours: updated.cancellationWindowHours,
      consultationTypes: updated.consultationTypes,
      addressLine: updated.addressLine,
      city: updated.city,
      country: updated.country,
      timezone: updated.timezone,
      verificationStatus: updated.verificationStatus,
      rejectionReason: updated.rejectionReason,
      autoConfirmBookings: updated.autoConfirmBookings,
      isAcceptingBookings: updated.isAcceptingBookings,
      ratingSum: updated.ratingSum,
      ratingCount: updated.ratingCount,
      publishedAt: updated.publishedAt,
      specializationIds: updated.specializations.map((s) => s.specializationId),
      languageIds: updated.languages.map((l) => l.languageId),
    },
  };
}

/** Toggles accepting bookings. */
export async function setAcceptingBookings(
  actor: { id: string },
  isAccepting: boolean,
): Promise<SubmitResult> {
  const profile = await getConsultantProfile(actor.id);
  if (!profile) throw new AuthorizationError("Consultant profile not found.");

  // Only allowed if already approved.
  if (profile.verificationStatus !== "APPROVED") {
    throw new AuthorizationError("Cannot toggle accepting bookings while not approved.");
  }

  const updated = await db.consultantProfile.update({
    where: { userId: actor.id },
    data: { isAcceptingBookings: isAccepting },
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

  return {
    status: "ok",
    profile: {
      id: updated.id,
      userId: updated.userId,
      slug: updated.slug,
      headline: updated.headline,
      bio: updated.bio,
      yearsOfExperience: updated.yearsOfExperience,
      sessionPriceMinor: updated.sessionPriceMinor,
      currency: updated.currency,
      sessionDurationMinutes: updated.sessionDurationMinutes,
      bufferMinutes: updated.bufferMinutes,
      minLeadTimeHours: updated.minLeadTimeHours,
      maxAdvanceDays: updated.maxAdvanceDays,
      cancellationWindowHours: updated.cancellationWindowHours,
      consultationTypes: updated.consultationTypes,
      addressLine: updated.addressLine,
      city: updated.city,
      country: updated.country,
      timezone: updated.timezone,
      verificationStatus: updated.verificationStatus,
      rejectionReason: updated.rejectionReason,
      autoConfirmBookings: updated.autoConfirmBookings,
      isAcceptingBookings: updated.isAcceptingBookings,
      ratingSum: updated.ratingSum,
      ratingCount: updated.ratingCount,
      publishedAt: updated.publishedAt,
      specializationIds: updated.specializations.map((s) => s.specializationId),
      languageIds: updated.languages.map((l) => l.languageId),
    },
  };
}

/** Submits the profile for verification. */
export async function submitForVerification(
  ctx: AuditContext,
): Promise<SubmitResult | NotCompleteResult> {
  const profile = await getConsultantProfile(ctx.actor.id);
  if (!profile) throw new NotFoundError("Consultant profile not found.");

  const completeness = checkCompleteness(profile);
  if (!completeness.isComplete) {
    return { status: "not_complete", missing: completeness.missing };
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.consultantProfile.update({
      where: { userId: ctx.actor.id },
      data: {
        verificationStatus: "PENDING",
        // Keep rejectionReason if REJECTED → PENDING (resubmission), else clear.
        ...(profile.verificationStatus === "REJECTED" ? {} : { rejectionReason: null }),
      },
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

    return result;
  });

  await writeAuditLog(ctx, {
    action: "SPECIALIZATION_UPDATED", // reused for consultant profile submission
    entityType: "ConsultantProfile",
    entityId: updated.id,
    metadata: { verificationStatus: "PENDING" },
  });

  logger.info({ userId: ctx.actor.id, verificationStatus: updated.verificationStatus }, "consultant submitted for verification");

  return {
    status: "ok",
    profile: {
      id: updated.id,
      userId: updated.userId,
      slug: updated.slug,
      headline: updated.headline,
      bio: updated.bio,
      yearsOfExperience: updated.yearsOfExperience,
      sessionPriceMinor: updated.sessionPriceMinor,
      currency: updated.currency,
      sessionDurationMinutes: updated.sessionDurationMinutes,
      bufferMinutes: updated.bufferMinutes,
      minLeadTimeHours: updated.minLeadTimeHours,
      maxAdvanceDays: updated.maxAdvanceDays,
      cancellationWindowHours: updated.cancellationWindowHours,
      consultationTypes: updated.consultationTypes,
      addressLine: updated.addressLine,
      city: updated.city,
      country: updated.country,
      timezone: updated.timezone,
      verificationStatus: updated.verificationStatus,
      rejectionReason: updated.rejectionReason,
      autoConfirmBookings: updated.autoConfirmBookings,
      isAcceptingBookings: updated.isAcceptingBookings,
      ratingSum: updated.ratingSum,
      ratingCount: updated.ratingCount,
      publishedAt: updated.publishedAt,
      specializationIds: updated.specializations.map((s) => s.specializationId),
      languageIds: updated.languages.map((l) => l.languageId),
    },
  };
}