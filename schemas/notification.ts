import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "APPOINTMENT_REQUESTED",
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_REMINDER",
  "APPOINTMENT_COMPLETED",
  "REVIEW_RECEIVED",
  "CONSULTANT_APPROVED",
  "CONSULTANT_REJECTED",
  "CONSULTANT_SUSPENDED",
]);

export const notificationPayloadSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(500),
  appointmentId: z.string().uuid().optional(),
  consultantProfileId: z.string().uuid().optional(),
  link: z.string().optional(),
});

export const markNotificationReadSchema = z.object({
  notificationId: z.string().uuid("Invalid notification ID"),
});

export const notificationFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type NotificationTypeEnum = z.infer<typeof notificationTypeSchema>;
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
