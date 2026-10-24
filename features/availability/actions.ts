"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireConsultant } from "@/server/authz/guards";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import {
  upsertRule,
  deleteRule,
  upsertException,
  deleteException,
} from "@/server/services/availability";
import { availabilityRuleSchema, availabilityExceptionSchema } from "@/schemas/availability";
import { formError, formSuccess, parseForm, type AuthFormState } from "@/features/auth/form-state";

/**
 * Server Actions for availability management (IMPLEMENTATION.md Step 11).
 */

export async function upsertAvailabilityRuleAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant({ approved: true });
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) return formError("Consultant profile not found.");

  const parsed = parseForm(availabilityRuleSchema, {
    id: formData.get("id") as string | undefined,
    weekday: formData.get("weekday") as string,
    startMinute: formData.get("startMinute") as string,
    endMinute: formData.get("endMinute") as string,
    effectiveFrom: formData.get("effectiveFrom") as string | null,
    effectiveUntil: formData.get("effectiveUntil") as string | null,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.ok) return parsed.state;

  await upsertRule(consultant, {
    consultantProfileId: profile.id,
    weekday: parsed.data.weekday,
    startMinute: parsed.data.startMinute,
    endMinute: parsed.data.endMinute,
    effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null,
    effectiveUntil: parsed.data.effectiveUntil ? new Date(parsed.data.effectiveUntil) : null,
    isActive: parsed.data.isActive,
  });

  updateTag(`availability:${profile.id}`);
  revalidatePath("/consultant/availability");
  return formSuccess("Availability rule saved.");
}

export async function deleteAvailabilityRuleAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant({ approved: true });
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) return formError("Consultant profile not found.");

  const id = formData.get("id") as string;
  if (!id) return formError("Missing rule ID.");

  await deleteRule(consultant, profile.id, id);

  updateTag(`availability:${profile.id}`);
  revalidatePath("/consultant/availability");
  return formSuccess("Availability rule deleted.");
}

export async function upsertAvailabilityExceptionAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant({ approved: true });
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) return formError("Consultant profile not found.");

  const parsed = parseForm(availabilityExceptionSchema, {
    id: formData.get("id") as string | undefined,
    date: formData.get("date") as string,
    type: formData.get("type") as "BLOCK" | "EXTRA",
    startMinute: formData.get("startMinute") as string | null,
    endMinute: formData.get("endMinute") as string | null,
    reason: formData.get("reason") as string | null,
  });

  if (!parsed.ok) return parsed.state;

  await upsertException(consultant, {
    consultantProfileId: profile.id,
    id: parsed.data.id,
    date: new Date(parsed.data.date),
    type: parsed.data.type,
    startMinute: parsed.data.startMinute ?? null,
    endMinute: parsed.data.endMinute ?? null,
    reason: parsed.data.reason ?? null,
  });

  updateTag(`availability:${profile.id}`);
  revalidatePath("/consultant/availability");
  return formSuccess("Availability exception saved.");
}

export async function deleteAvailabilityExceptionAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant({ approved: true });
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) return formError("Consultant profile not found.");

  const id = formData.get("id") as string;
  if (!id) return formError("Missing exception ID.");

  await deleteException(consultant, profile.id, id);

  updateTag(`availability:${profile.id}`);
  revalidatePath("/consultant/availability");
  return formSuccess("Availability exception deleted.");
}

export async function copyWeekAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const consultant = await requireConsultant({ approved: true });
  const profile = await getConsultantProfile(consultant.id);

  if (!profile) return formError("Consultant profile not found.");

  const sourceWeekOffset = parseInt(formData.get("sourceWeekOffset") as string) || 0;
  const targetWeekOffset = parseInt(formData.get("targetWeekOffset") as string) || 1;

  // Copy rules from source week to target week by adjusting weekdays
  // Rules are weekly, so we just copy them with isActive=true
  const { copyWeek } = await import("@/server/dal/availability");
  const result = await copyWeek(profile.id, sourceWeekOffset, targetWeekOffset);

  updateTag(`availability:${profile.id}`);
  revalidatePath("/consultant/availability");
  return formSuccess(`Copied ${result.created} rule(s) for next week.`);
}
