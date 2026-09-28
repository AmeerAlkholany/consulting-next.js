import { z } from "zod";
import { isValidIanaTimezone } from "@/lib/datetime";

export const emailSchema = z
  .string()
  .trim()
  .email("Please provide a valid email address.")
  .max(255);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(128, "Password must not exceed 128 characters.");

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase alphanumeric characters and hyphens.",
  );

export const ianaTimezoneSchema = z.string().trim().refine(isValidIanaTimezone, {
  message: "Must be a valid IANA timezone.",
});

export const idSchema = z.string().trim().min(1, "Identifier is required.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
