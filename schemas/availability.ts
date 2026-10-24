import { z } from "zod";
import { isValidIanaTimezone } from "@/lib/datetime";

/** Day of week: 0 = Monday ... 6 = Sunday */
const dayOfWeekSchema = z.coerce.number().int().min(0).max(6);

/** Minutes from local midnight, 0–1439, on a 5-minute grid */
const minuteGridSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(1439)
  .refine((v) => v % 5 === 0, "Must be on a 5-minute grid.");

/** Minutes from local midnight, 1–1440, on a 5-minute grid (1440 represents 24:00) */
const endMinuteGridSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(1440)
  .refine((v) => v % 5 === 0, "Must be on a 5-minute grid.");

/** ISO date string */
const dateStringSchema = z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date.");

/** Availability rule input */
export const availabilityRuleSchema = z
  .object({
    id: z.string().uuid().optional(),
    weekday: dayOfWeekSchema,
    startMinute: minuteGridSchema,
    endMinute: endMinuteGridSchema,
    effectiveFrom: dateStringSchema.optional().nullable(),
    effectiveUntil: dateStringSchema.optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.startMinute < data.endMinute, {
    message: "End minute must be after start minute.",
    path: ["endMinute"],
  })
  .refine(
    (data) => {
      if (data.effectiveFrom && data.effectiveUntil) {
        return new Date(data.effectiveFrom) <= new Date(data.effectiveUntil);
      }
      return true;
    },
    {
      message: "Effective until must be after effective from.",
      path: ["effectiveUntil"],
    },
  )
  .refine(
    (data) => {
      if (data.effectiveFrom) {
        return new Date(data.effectiveFrom) >= new Date(new Date().toISOString().split("T")[0]);
      }
      return true;
    },
    {
      message: "Effective from cannot be in the past.",
      path: ["effectiveFrom"],
    },
  );

/** Availability exception input */
export const availabilityExceptionSchema = z
  .object({
    id: z.string().uuid().optional(),
    date: dateStringSchema,
    type: z.enum(["BLOCK", "EXTRA"]),
    startMinute: minuteGridSchema.optional().nullable(),
    endMinute: minuteGridSchema.optional().nullable(),
    reason: z.string().max(200).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.type === "BLOCK") {
        return true; // BLOCK with null minutes = whole day
      }
      // EXTRA must have both minutes
      return data.startMinute != null && data.endMinute != null;
    },
    {
      message: "Extra hours require start and end minutes.",
      path: ["startMinute"],
    },
  )
  .refine(
    (data) => {
      // Use != null to handle both undefined and null
      if (data.startMinute != null && data.endMinute != null) {
        return data.startMinute < data.endMinute;
      }
      return true;
    },
    {
      message: "End minute must be after start minute.",
      path: ["endMinute"],
    },
  )
  .refine(
    (data) => {
      const d = new Date(data.date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const max = new Date(now);
      max.setDate(max.getDate() + 365);
      return d >= now && d <= max;
    },
    {
      message: "Date must be within the next 365 days.",
      path: ["date"],
    },
  );

/** API query params for availability */
export const availabilityQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
    tz: z.string().refine(isValidIanaTimezone, "Invalid timezone."),
  })
  .refine((data) => new Date(data.from) < new Date(data.to), {
    message: "From must be before to.",
    path: ["to"],
  })
  .refine(
    (data) => {
      const diffDays =
        (new Date(data.to).getTime() - new Date(data.from).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 31;
    },
    {
      message: "Range cannot exceed 31 days.",
      path: ["to"],
    },
  );

export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;
export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionSchema>;
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
