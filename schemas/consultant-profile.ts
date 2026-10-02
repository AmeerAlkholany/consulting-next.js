import { z } from "zod";
import { isValidIanaTimezone } from "@/lib/datetime";

/** Generate a URL-safe slug from a name with numeric disambiguator. */
export function generateSlug(name: string, existingSlugs: string[] = []): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  if (!existingSlugs.includes(base)) return base;

  let n = 2;
  let candidate = `${base}-${n}`;
  while (existingSlugs.includes(candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

const validSessionDurations = [30, 45, 50, 60, 90] as const;
const validCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

export const consultantProfileSchema = z
  .object({
    headline: z
      .string()
      .trim()
      .min(10, "Headline must be at least 10 characters.")
      .max(120, "Headline must be 120 characters or fewer."),
    bio: z
      .string()
      .trim()
      .min(50, "Biography must be at least 50 characters.")
      .max(4000, "Biography must be 4000 characters or fewer."),
    yearsOfExperience: z.coerce.number().int().min(0).max(70),
    sessionPriceMinor: z.coerce.number().int().positive("Price must be greater than zero."),
    currency: z.enum(validCurrencies, { message: "Select a valid currency." }),
    sessionDurationMinutes: z.coerce.number().int().refine((v) => validSessionDurations.includes(v as (typeof validSessionDurations)[number]), {
      message: "Session duration must be 30, 45, 50, 60, or 90 minutes.",
    }),
    bufferMinutes: z.coerce.number().int().min(0).max(60),
    minLeadTimeHours: z.coerce.number().int().min(0).max(168),
    maxAdvanceDays: z.coerce.number().int().min(1).max(180),
    cancellationWindowHours: z.coerce.number().int().min(0).max(168),
    consultationTypes: z.array(z.enum(["ONLINE", "IN_PERSON"])).min(1, "Select at least one consultation type."),
    addressLine: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    timezone: z.string().trim().refine(isValidIanaTimezone, { message: "Select a valid timezone." }),
    specializationIds: z.array(z.string().uuid()).min(1, "Select at least one specialization.").max(5, "Select at most 5 specializations."),
    languageIds: z.array(z.string().uuid()).min(1, "Select at least one language."),
    autoConfirmBookings: z.boolean().default(false),
    isAcceptingBookings: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.consultationTypes.includes("IN_PERSON")) {
        return data.addressLine && data.city && data.country;
      }
      return true;
    },
    {
      message: "Address is required when offering in-person consultations.",
      path: ["addressLine"],
    },
  );

export const qualificationSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(120, "Title must be 120 characters or fewer."),
  institution: z.string().trim().min(2, "Institution must be at least 2 characters.").max(120, "Institution must be 120 characters or fewer."),
  awardedYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()),
  credentialId: z.string().optional().nullable(),
  documentUrl: z.string().url().optional().nullable(),
});

export const pricingPolicySchema = z.object({
  sessionPriceMinor: z.coerce.number().int().positive("Price must be greater than zero."),
  currency: z.enum(validCurrencies),
  sessionDurationMinutes: z.coerce.number().int().refine((v) => validSessionDurations.includes(v as (typeof validSessionDurations)[number])),
  bufferMinutes: z.coerce.number().int().min(0).max(60),
  minLeadTimeHours: z.coerce.number().int().min(0).max(168),
  maxAdvanceDays: z.coerce.number().int().min(1).max(180),
  cancellationWindowHours: z.coerce.number().int().min(0).max(168),
  autoConfirmBookings: z.boolean(),
  isAcceptingBookings: z.boolean(),
});

export const setSpecializationsSchema = z.object({
  specializationIds: z.array(z.string().uuid()).min(1, "Select at least one specialization.").max(5, "Select at most 5 specializations."),
});

export const setLanguagesSchema = z.object({
  languageIds: z.array(z.string().uuid()).min(1, "Select at least one language."),
});

export type ConsultantProfileInput = z.infer<typeof consultantProfileSchema>;
export type QualificationInput = z.infer<typeof qualificationSchema>;
export type PricingPolicyInput = z.infer<typeof pricingPolicySchema>;
export type SetSpecializationsInput = z.infer<typeof setSpecializationsSchema>;
export type SetLanguagesInput = z.infer<typeof setLanguagesSchema>;