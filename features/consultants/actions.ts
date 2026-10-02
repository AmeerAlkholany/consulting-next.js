"use server";

import { revalidatePath } from "next/cache";
import { requireConsultant } from "@/server/authz/guards";
import { getSession } from "@/server/auth/dal";
import { readAuthRequestContext } from "@/server/auth/request-context";
import {
  updateConsultantProfile,
  upsertQualification,
  deleteQualification,
  setSpecializations,
  setLanguages,
  updatePricingPolicy,
  submitForVerification,
  setAcceptingBookings,
  checkCompleteness,
} from "@/server/services/consultants";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import {
  consultantProfileSchema,
  qualificationSchema,
  pricingPolicySchema,
  setSpecializationsSchema,
  setLanguagesSchema,
} from "@/schemas/consultant-profile";
import { formError, formSuccess, parseForm, type AuthFormState } from "@/features/auth/form-state";

/**
 * Server Actions for consultant profile management (IMPLEMENTATION.md Step 8).
 */

export async function updateConsultantProfileAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant();

  const parsed = parseForm(consultantProfileSchema, {
    headline: formData.get("headline") as string,
    bio: formData.get("bio") as string,
    yearsOfExperience: formData.get("yearsOfExperience") as string,
    sessionPriceMinor: formData.get("sessionPriceMinor") as string,
    currency: formData.get("currency") as string,
    sessionDurationMinutes: formData.get("sessionDurationMinutes") as string,
    bufferMinutes: formData.get("bufferMinutes") as string,
    minLeadTimeHours: formData.get("minLeadTimeHours") as string,
    maxAdvanceDays: formData.get("maxAdvanceDays") as string,
    cancellationWindowHours: formData.get("cancellationWindowHours") as string,
    consultationTypes: formData.getAll("consultationTypes") as string[],
    addressLine: formData.get("addressLine") as string | null,
    city: formData.get("city") as string | null,
    country: formData.get("country") as string | null,
    timezone: formData.get("timezone") as string,
    specializationIds: formData.getAll("specializationIds") as string[],
    languageIds: formData.getAll("languageIds") as string[],
    autoConfirmBookings: formData.get("autoConfirmBookings") === "on",
    isAcceptingBookings: formData.get("isAcceptingBookings") === "on",
  });

  if (!parsed.ok) return parsed.state;

  const ctx = await readAuthRequestContext();
  const result = await updateConsultantProfile(consultant, parsed.data);

  if ("status" in result && result.status !== "ok") {
    return formError("Failed to update profile.");
  }

  revalidatePath("/consultant/profile");
  revalidatePath("/consultant");
  return formSuccess("Profile updated.");
}

export async function upsertQualificationAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant();

  const parsed = parseForm(qualificationSchema, {
    id: formData.get("id") as string | undefined,
    title: formData.get("title") as string,
    institution: formData.get("institution") as string,
    awardedYear: formData.get("awardedYear") as string,
    credentialId: formData.get("credentialId") as string | null,
    documentUrl: formData.get("documentUrl") as string | null,
  });

  if (!parsed.ok) return parsed.state;

  await upsertQualification(consultant, parsed.data);
  revalidatePath("/consultant/profile");
  return formSuccess(parsed.data.id ? "Qualification updated." : "Qualification added.");
}

export async function deleteQualificationAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant();

  const id = formData.get("id") as string;
  if (!id) return formError("Missing qualification ID.");

  await deleteQualification(consultant, id);
  revalidatePath("/consultant/profile");
  return formSuccess("Qualification deleted.");
}

export async function setSpecializationsAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant();

  const parsed = parseForm(setSpecializationsSchema, {
    specializationIds: formData.getAll("specializationIds") as string[],
  });

  if (!parsed.ok) return parsed.state;

  await setSpecializations(consultant, parsed.data);
  revalidatePath("/consultant/profile");
  return formSuccess("Specializations updated.");
}

export async function setLanguagesAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant();

  const parsed = parseForm(setLanguagesSchema, {
    languageIds: formData.getAll("languageIds") as string[],
  });

  if (!parsed.ok) return parsed.state;

  await setLanguages(consultant, parsed.data);
  revalidatePath("/consultant/profile");
  return formSuccess("Languages updated.");
}

export async function updatePricingPolicyAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant();

  const parsed = parseForm(pricingPolicySchema, {
    sessionPriceMinor: formData.get("sessionPriceMinor") as string,
    currency: formData.get("currency") as string,
    sessionDurationMinutes: formData.get("sessionDurationMinutes") as string,
    bufferMinutes: formData.get("bufferMinutes") as string,
    minLeadTimeHours: formData.get("minLeadTimeHours") as string,
    maxAdvanceDays: formData.get("maxAdvanceDays") as string,
    cancellationWindowHours: formData.get("cancellationWindowHours") as string,
    autoConfirmBookings: formData.get("autoConfirmBookings") === "on",
    isAcceptingBookings: formData.get("isAcceptingBookings") === "on",
  });

  if (!parsed.ok) return parsed.state;

  const result = await updatePricingPolicy(consultant, parsed.data);
  if (result.status !== "ok") return formError("Failed to update pricing policy.");

  revalidatePath("/consultant/profile");
  revalidatePath("/consultant");
  return formSuccess("Pricing & policy updated.");
}

export async function submitForVerificationAction(
  _prevState: AuthFormState,
  _formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant();

  const ctx = await readAuthRequestContext();
  const result = await submitForVerification({ actor: consultant, ipHash: ctx.ipHash });

  if (result.status === "not_complete") {
    return formError(`Profile incomplete: ${result.missing.join(", ")}`);
  }

  revalidatePath("/consultant/profile");
  revalidatePath("/consultant");
  return formSuccess("Profile submitted for verification.");
}

export async function setAcceptingBookingsAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant();

  const isAccepting = formData.get("isAccepting") === "on";
  const result = await setAcceptingBookings(consultant, isAccepting);

  if (result.status !== "ok") return formError("Cannot toggle accepting bookings.");

  revalidatePath("/consultant/profile");
  revalidatePath("/consultant");
  return formSuccess(isAccepting ? "Now accepting bookings." : "No longer accepting bookings.");
}