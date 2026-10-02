"use server";

import { revalidatePath } from "next/cache";
import { getClientProfile } from "@/server/dal/client-profile";
import { requireClient } from "@/server/authz/guards";
import { getCurrentUser } from "@/server/auth/dal";
import {
  updateClientProfile,
  changePassword as changePasswordService,
  requestAccountDeletion,
  type Blocker,
} from "@/server/services/clients";
import { clientProfileSchema, changePasswordSchema, requestAccountDeletionSchema } from "@/schemas/client-profile";
import { verifyPassword } from "@/server/auth/password";
import { formError, formSuccess, parseForm, type AuthFormState } from "@/features/auth/form-state";

/**
 * Server Actions for client profile management (IMPLEMENTATION.md Step 6).
 */

export async function updateClientProfileAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireClient();

  const parsed = parseForm(clientProfileSchema, {
    displayName: formData.get("displayName") as string,
    fullName: formData.get("fullName") as string,
    phone: formData.get("phone") as string | null,
    dateOfBirth: formData.get("dateOfBirth") as string | null,
    timezone: formData.get("timezone") as string,
    languageIds: formData.getAll("languageIds") as string[],
    emergencyContactName: formData.get("emergencyContactName") as string | null,
    emergencyContactPhone: formData.get("emergencyContactPhone") as string | null,
  });

  if (!parsed.ok) return parsed.state;

  const result = await updateClientProfile(user, parsed.data);

  if (result.status === "not_found") {
    return formError("Profile not found. Please try again.");
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return formSuccess("Profile updated successfully.");
}

export async function changePasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireClient();

  const parsed = parseForm(changePasswordSchema, {
    currentPassword: formData.get("currentPassword") as string,
    newPassword: formData.get("newPassword") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  });

  if (!parsed.ok) return parsed.state;

  try {
    await changePasswordService(user, parsed.data, verifyPassword);
    revalidatePath("/profile");
    return formSuccess("Password changed successfully. Other sessions have been signed out.");
  } catch (error) {
    if (error instanceof Error) {
      return formError(error.message);
    }
    return formError("Failed to change password. Please try again.");
  }
}

export async function requestAccountDeletionAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireClient();

  const parsed = parseForm(requestAccountDeletionSchema, {
    confirmText: formData.get("confirmText") as string,
  });

  if (!parsed.ok) return parsed.state;

  const result = await requestAccountDeletion(user);

  if (result.status === "blocked") {
    const appointmentList = result.appointments
      .map((a: Blocker) => `${a.consultantName} on ${a.startsAt.toISOString().slice(0, 10)}`)
      .join(", ");
    return formError(
      `Cannot delete account while you have future appointments: ${appointmentList}. Cancel them first.`,
    );
  }

  // On successful deletion, sign out immediately
  revalidatePath("/");
  return formSuccess("Your account has been deleted.");
}
