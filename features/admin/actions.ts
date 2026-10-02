"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/authz/guards";
import { readAuthRequestContext } from "@/server/auth/request-context";
import {
  approveConsultant,
  rejectConsultant,
  suspendConsultant,
  reinstateConsultant,
} from "@/server/services/admin";
import { verificationDecisionSchema, consultantFilterSchema } from "@/schemas/admin";
import { formError, formSuccess, parseForm, type AuthFormState } from "@/features/auth/form-state";

/**
 * Server Actions for admin consultant verification (IMPLEMENTATION.md Step 9).
 */

export async function approveConsultantAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const parsed = parseForm(verificationDecisionSchema, {
    consultantProfileId: formData.get("consultantProfileId") as string,
    action: "approve",
    reason: formData.get("reason") ? (formData.get("reason") as string) : undefined,
    internalNote: formData.get("internalNote") ? (formData.get("internalNote") as string) : undefined,
  });

  if (!parsed.ok) return parsed.state;

  const ctx = await readAuthRequestContext();
  const result = await approveConsultant({ actor: admin, ipHash: ctx.ipHash }, parsed.data.consultantProfileId, parsed.data.reason, parsed.data.internalNote);

  if (result.status === "invalid_state") {
    return formError(`Cannot approve consultant with status: ${result.currentStatus}`);
  }
  if (result.status === "not_found") {
    return formError("Consultant profile not found.");
  }

  revalidatePath("/admin/consultants");
  revalidatePath("/admin");
  return formSuccess("Consultant approved.");
}

export async function rejectConsultantAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const parsed = parseForm(verificationDecisionSchema, {
    consultantProfileId: formData.get("consultantProfileId") as string,
    action: "reject",
    reason: formData.get("reason") ? (formData.get("reason") as string) : undefined,
    internalNote: formData.get("internalNote") ? (formData.get("internalNote") as string) : undefined,
  });

  if (!parsed.ok) return parsed.state;

  const ctx = await readAuthRequestContext();
  const result = await rejectConsultant({ actor: admin, ipHash: ctx.ipHash }, parsed.data.consultantProfileId, parsed.data.reason ?? "", parsed.data.internalNote);

  if (result.status === "invalid_state") {
    return formError(`Cannot reject consultant with status: ${result.currentStatus}`);
  }
  if (result.status === "not_found") {
    return formError("Consultant profile not found.");
  }

  revalidatePath("/admin/consultants");
  revalidatePath("/admin");
  return formSuccess("Consultant rejected.");
}

export async function suspendConsultantAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const parsed = parseForm(verificationDecisionSchema, {
    consultantProfileId: formData.get("consultantProfileId") as string,
    action: "suspend",
    reason: formData.get("reason") ? (formData.get("reason") as string) : undefined,
    internalNote: formData.get("internalNote") ? (formData.get("internalNote") as string) : undefined,
  });

  if (!parsed.ok) return parsed.state;

  const ctx = await readAuthRequestContext();
  const result = await suspendConsultant({ actor: admin, ipHash: ctx.ipHash }, parsed.data.consultantProfileId, parsed.data.reason ?? "", parsed.data.internalNote);

  if (result.status === "invalid_state") {
    return formError(`Cannot suspend consultant with status: ${result.currentStatus}`);
  }
  if (result.status === "not_found") {
    return formError("Consultant profile not found.");
  }

  revalidatePath("/admin/consultants");
  revalidatePath("/admin");
  return formSuccess("Consultant suspended.");
}

export async function reinstateConsultantAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const parsed = parseForm(verificationDecisionSchema, {
    consultantProfileId: formData.get("consultantProfileId") as string,
    action: "reinstate",
    reason: formData.get("reason") ? (formData.get("reason") as string) : undefined,
    internalNote: formData.get("internalNote") ? (formData.get("internalNote") as string) : undefined,
  });

  if (!parsed.ok) return parsed.state;

  const ctx = await readAuthRequestContext();
  const result = await reinstateConsultant({ actor: admin, ipHash: ctx.ipHash }, parsed.data.consultantProfileId, parsed.data.reason, parsed.data.internalNote);

  if (result.status === "invalid_state") {
    return formError(`Cannot reinstate consultant with status: ${result.currentStatus}`);
  }
  if (result.status === "not_found") {
    return formError("Consultant profile not found.");
  }

  revalidatePath("/admin/consultants");
  revalidatePath("/admin");
  return formSuccess("Consultant reinstated.");
}

export async function filterConsultantsAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const parsed = parseForm(consultantFilterSchema, {
    status: formData.get("status") as string,
    search: formData.get("search") as string,
    page: formData.get("page") as string,
    perPage: formData.get("perPage") as string,
  });

  if (!parsed.ok) return parsed.state;

  // This action is for filter submission, redirect is handled by the page
  return formSuccess("Filtered.");
}