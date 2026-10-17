import { z } from "zod";

/**
 * Booking input contracts (IMPLEMENTATION.md Step 12).
 *
 * One schema per boundary, shared by the client form and the Server Action.
 */

export const bookingSchema = z
  .object({
    consultantProfileId: z.string().uuid("Invalid consultant profile."),
    startsAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid start time."),
    endsAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid end time."),
    consultationType: z.enum(["ONLINE", "IN_PERSON"]),
    clientNote: z.string().max(1000).optional().nullable(),
    /** Idempotency key to de-duplicate double submits. */
    idempotencyKey: z.string().min(1).max(100),
  })
  .refine((data) => new Date(data.startsAt) < new Date(data.endsAt), {
    message: "End time must be after start time.",
    path: ["endsAt"],
  })
  .refine(
    (data) => {
      const diffMinutes =
        (new Date(data.endsAt).getTime() - new Date(data.startsAt).getTime()) / (1000 * 60);
      return diffMinutes >= 30 && diffMinutes <= 120;
    },
    {
      message: `Session duration must be between 30 and 120 minutes.`,
      path: ["endsAt"],
    },
  );

export const cancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID."),
  reason: z.string().max(500).optional().nullable(),
});

export const rescheduleAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID."),
  startsAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid start time."),
  endsAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid end time."),
  clientNote: z.string().max(1000).optional().nullable(),
});

export const reviewSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID."),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

export const reviewEditSchema = z.object({
  reviewId: z.string().uuid("Invalid review ID."),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ReviewEditInput = z.infer<typeof reviewEditSchema>;
