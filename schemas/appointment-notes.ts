import { z } from "zod";

export const appointmentNoteVisibilitySchema = z.enum(["CONSULTANT_ONLY", "SHARED"]);

export const upsertAppointmentNoteSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID"),
  body: z
    .string()
    .trim()
    .min(1, "Note content cannot be empty")
    .max(5000, "Note content cannot exceed 5000 characters"),
  visibility: appointmentNoteVisibilitySchema.default("CONSULTANT_ONLY"),
});

export const deleteAppointmentNoteSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID"),
  noteId: z.string().uuid("Invalid note ID"),
});

export type UpsertAppointmentNoteInput = z.infer<typeof upsertAppointmentNoteSchema>;
export type DeleteAppointmentNoteInput = z.infer<typeof deleteAppointmentNoteSchema>;
