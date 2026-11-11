"use server";

import { revalidatePath } from "next/cache";
import { requireConsultant } from "@/server/authz/guards";
import {
  confirmAppointment,
  declineAppointment,
  completeAppointment,
  markNoShowAppointment,
} from "@/server/services/booking";
import { upsertAppointmentNote, deleteAppointmentNote } from "@/server/services/appointment-notes";
import { upsertAppointmentNoteSchema } from "@/schemas/appointment-notes";

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export async function confirmAppointmentAction(appointmentId: string): Promise<ActionResult> {
  const actor = await requireConsultant();
  const res = await confirmAppointment(actor, appointmentId);
  if (res.status === "error") {
    return { success: false, message: res.message };
  }
  revalidatePath("/consultant");
  revalidatePath("/consultant/appointments");
  revalidatePath(`/consultant/appointments/${appointmentId}`);
  return { success: true };
}

export async function declineAppointmentAction(
  appointmentId: string,
  reason: string,
): Promise<ActionResult> {
  const actor = await requireConsultant();
  const res = await declineAppointment(actor, { appointmentId, reason });
  if (res.status === "error") {
    return { success: false, message: res.message };
  }
  revalidatePath("/consultant");
  revalidatePath("/consultant/appointments");
  revalidatePath(`/consultant/appointments/${appointmentId}`);
  return { success: true };
}

export async function markCompletedAction(appointmentId: string): Promise<ActionResult> {
  const actor = await requireConsultant();
  const res = await completeAppointment(actor, appointmentId);
  if (res.status === "error") {
    return { success: false, message: res.message };
  }
  revalidatePath("/consultant");
  revalidatePath("/consultant/appointments");
  revalidatePath(`/consultant/appointments/${appointmentId}`);
  return { success: true };
}

export async function markNoShowAction(appointmentId: string): Promise<ActionResult> {
  const actor = await requireConsultant();
  const res = await markNoShowAppointment(actor, appointmentId);
  if (res.status === "error") {
    return { success: false, message: res.message };
  }
  revalidatePath("/consultant");
  revalidatePath("/consultant/appointments");
  revalidatePath(`/consultant/appointments/${appointmentId}`);
  return { success: true };
}

export async function upsertAppointmentNoteAction(input: {
  appointmentId: string;
  noteId?: string;
  body: string;
}): Promise<ActionResult> {
  const actor = await requireConsultant();
  const parsed = upsertAppointmentNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid note input",
    };
  }

  try {
    const note = await upsertAppointmentNote(actor, {
      appointmentId: parsed.data.appointmentId,
      noteId: input.noteId,
      body: parsed.data.body,
      visibility: parsed.data.visibility,
    });
    revalidatePath(`/consultant/appointments/${input.appointmentId}`);
    return { success: true, data: note };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to save note",
    };
  }
}

export async function deleteAppointmentNoteAction(
  appointmentId: string,
  noteId: string,
): Promise<ActionResult> {
  const actor = await requireConsultant();
  try {
    await deleteAppointmentNote(actor, appointmentId, noteId);
    revalidatePath(`/consultant/appointments/${appointmentId}`);
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to delete note",
    };
  }
}
