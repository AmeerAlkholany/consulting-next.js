import { z } from "zod";
import { passwordFieldSchema } from "@/schemas/auth";

/** E.164 phone regex — international format with optional leading + */
const phoneRegex = /^\+[1-9]\d{1,14}$/;

export const clientProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Display name must be at least 2 characters.")
      .max(50, "Display name must be 50 characters or fewer."),
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters.")
      .max(100, "Full name must be 100 characters or fewer."),
    phone: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === "" ? null : v))
      .refine(
        (v) => v === undefined || v === null || (typeof v === "string" && phoneRegex.test(v)),
        "Phone must be a valid E.164 number (e.g. +1234567890).",
      ),
    dateOfBirth: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === "" ? null : v))
      .refine(
        (v) => v === undefined || v === null || (typeof v === "string" && !isNaN(new Date(v).getTime())),
        "Date of birth must be a valid date.",
      )
      .refine(
        (v) => {
          if (v === undefined || v === null || typeof v !== "string") return true;
          const dob = new Date(v);
          const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          return age >= 16;
        },
        "You must be at least 16 years old.",
      ),
    timezone: z.string().trim().min(1, "Timezone is required."),
    languageIds: z.array(z.string()).default([]),
    emergencyContactName: z.string().optional().nullable().default(null),
    emergencyContactPhone: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === "" ? null : v))
      .refine(
        (v) => v === undefined || v === null || (typeof v === "string" && phoneRegex.test(v)),
        "Emergency phone must be a valid E.164 number.",
      ),
  })
  .refine(
    (data) => {
      // Emergency contact phone requires a name. Treat undefined as "not provided".
      const hasPhone = data.emergencyContactPhone !== undefined && data.emergencyContactPhone !== null;
      const hasName = data.emergencyContactName !== undefined && data.emergencyContactName !== null;
      if (hasPhone && !hasName) return false;
      return true;
    },
    { message: "Emergency contact name is required when providing a phone number.", path: ["emergencyContactName"] },
  );

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordFieldSchema,
    confirmPassword: z.string().min(1, "Repeat your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const requestAccountDeletionSchema = z.object({
  confirmText: z.literal("DELETE"),
});

export type ClientProfileInput = z.infer<typeof clientProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;
