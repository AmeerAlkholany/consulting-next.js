"use server";

import { revalidatePath } from "next/cache";
import { requireClient } from "@/server/authz/guards";
import { createBooking, cancelAppointment, rescheduleAppointment } from "@/server/services/booking";
import {
  bookingSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
} from "@/schemas/booking";
import { formError, formSuccess, parseForm, type AuthFormState } from "@/features/auth/form-state";

/**
 * Server Actions for booking flow (IMPLEMENTATION.md Step 12).
 */

export async function bookAppointmentAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const client = await requireClient();

  const parsed = parseForm(bookingSchema, {
    consultantProfileId: formData.get("consultantProfileId") as string,
    startsAt: formData.get("startsAt") as string,
    endsAt: formData.get("endsAt") as string,
    consultationType: formData.get("consultationType") as "ONLINE" | "IN_PERSON",
    clientNote: formData.get("clientNote") as string | null,
    idempotencyKey: formData.get("idempotencyKey") as string,
  });

  if (!parsed.ok) return parsed.state;

  const result = await createBooking(client, parsed.data);

  if (result.status === "conflict") {
    return formError(result.message);
  }
  if (result.status === "not_found") {
    return formError("Consultant not found or no longer accepting bookings.");
  }

  revalidatePath("/appointments");
  revalidatePath("/consultants/[slug]", "layout");
  return formSuccess(
    result.autoConfirmed
      ? "Your appointment is confirmed. You will receive an email confirmation shortly."
      : "Your appointment request has been sent. The consultant will confirm it shortly.",
  );
}

export async function cancelAppointmentAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const actor = await requireClient();

  const parsed = parseForm(cancelAppointmentSchema, {
    appointmentId: formData.get("appointmentId") as string,
    reason: formData.get("reason") as string | null,
  });

  if (!parsed.ok) return parsed.state;

  const result = await cancelAppointment(actor, parsed.data);

  if (result.status === "error") {
    return formError(result.message);
  }

  revalidatePath("/appointments");
  revalidatePath("/consultant/appointments");
  return formSuccess("Appointment cancelled.");
}

export async function rescheduleAppointmentAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const actor = await requireClient();

  const parsed = parseForm(rescheduleAppointmentSchema, {
    appointmentId: formData.get("appointmentId") as string,
    startsAt: formData.get("startsAt") as string,
    endsAt: formData.get("endsAt") as string,
    clientNote: formData.get("clientNote") as string | null,
  });

  if (!parsed.ok) return parsed.state;

  const result = await rescheduleAppointment(actor, parsed.data);

  if (result.status === "error") {
    return formError(result.message);
  }

  revalidatePath("/appointments");
  revalidatePath("/consultant/appointments");
  return formSuccess("Appointment rescheduled successfully.");
}
