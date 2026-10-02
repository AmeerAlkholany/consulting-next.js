"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/authz/guards";
import { getSession } from "@/server/auth/dal";
import { readAuthRequestContext } from "@/server/auth/request-context";
import {
  createSpecialization,
  updateSpecialization,
  reorderSpecializations,
  disableSpecialization,
  enableSpecialization,
} from "@/server/services/specializations";
import { specializationSchema, updateSpecializationSchema, reorderSpecializationsSchema, specializationIdSchema } from "@/schemas/taxonomy";
import { formError, formSuccess, parseForm, type AuthFormState } from "@/features/auth/form-state";

/**
 * Server Actions for admin taxonomy management (IMPLEMENTATION.md Step 7).
 */

export async function createSpecializationAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const parsed = parseForm(specializationSchema, {
    name: formData.get("name") as string,
    description: formData.get("description") as string | null,
    sortOrder: formData.get("sortOrder") as string | null,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.ok) return parsed.state;

  const ctx = await readAuthRequestContext();
  const result = await createSpecialization({ actor: admin, ipHash: ctx.ipHash }, parsed.data);

  if (result.status === "conflict") {
    return formError(result.message, { [result.field]: [result.message] });
  }

  if (result.status === "not_found") {
    return formError("Specialization not found.");
  }

  revalidatePath("/admin/specializations");
  return formSuccess("Specialization created.");
}

export async function updateSpecializationAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const id = formData.get("id") as string;
  const idParsed = specializationIdSchema.safeParse(id);
  if (!idParsed.success) return formError("Invalid specialization ID.");

  const parsed = parseForm(updateSpecializationSchema, {
    name: formData.get("name") as string,
    description: formData.get("description") as string | null,
    sortOrder: formData.get("sortOrder") as string | null,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.ok) return parsed.state;

  const ctx = await readAuthRequestContext();
  const result = await updateSpecialization({ actor: admin, ipHash: ctx.ipHash }, id, parsed.data);

  if (result.status === "conflict") {
    return formError(result.message, { [result.field]: [result.message] });
  }

  if (result.status === "not_found") {
    return formError("Specialization not found.");
  }

  revalidatePath("/admin/specializations");
  return formSuccess("Specialization updated.");
}

export async function reorderSpecializationsAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const raw = formData.get("items") as string;
  const parsed = reorderSpecializationsSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return formError("Invalid reorder payload.");
  }

  const ctx = await readAuthRequestContext();
  const result = await reorderSpecializations({ actor: admin, ipHash: ctx.ipHash }, parsed.data);

  if (result.status === "not_found") {
    return formError("One or more specializations not found.");
  }

  revalidatePath("/admin/specializations");
  return formSuccess("Order updated.");
}

export async function disableSpecializationAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const id = formData.get("id") as string;
  const idParsed = specializationIdSchema.safeParse(id);
  if (!idParsed.success) return formError("Invalid specialization ID.");

  const ctx = await readAuthRequestContext();
  const result = await disableSpecialization({ actor: admin, ipHash: ctx.ipHash }, id);

  if (result.status === "not_found") {
    return formError("Specialization not found.");
  }

  revalidatePath("/admin/specializations");
  return formSuccess("Specialization disabled.");
}

export async function enableSpecializationAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const admin = await requireAdmin();

  const id = formData.get("id") as string;
  const idParsed = specializationIdSchema.safeParse(id);
  if (!idParsed.success) return formError("Invalid specialization ID.");

  const ctx = await readAuthRequestContext();
  const result = await enableSpecialization({ actor: admin, ipHash: ctx.ipHash }, id);

  if (result.status === "not_found") {
    return formError("Specialization not found.");
  }

  revalidatePath("/admin/specializations");
  return formSuccess("Specialization enabled.");
}