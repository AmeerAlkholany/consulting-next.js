import { z } from "zod";
import { passwordPolicy } from "@/config/security";
import { isCommonPassword, isPasswordAcceptable, countPasswordCharacterClasses } from "@/lib/password-strength";
import { emailSchema, ianaTimezoneSchema } from "./common";

/**
 * Authentication input contracts (IMPLEMENTATION.md Step 4, ARCHITECTURE.md §9).
 *
 * One schema per boundary, shared by the client form (`zodResolver`) and the
 * Server Action. The action's parse is authoritative: a crafted POST never
 * reaches a service with a value only the UI was expected to constrain —
 * notably `role`, where `ADMIN` is rejected here rather than merely absent from
 * the radio group.
 */

/**
 * The password rule: length bounds, at least three of the four character
 * classes, and not a common password. `isPasswordAcceptable` is the same
 * function `lib/password-strength.ts` reports on, so the meter and the
 * rejection never disagree.
 */
export const passwordFieldSchema = z
  .string()
  .min(passwordPolicy.minLength, `Use at least ${passwordPolicy.minLength} characters.`)
  .max(passwordPolicy.maxLength, `Use at most ${passwordPolicy.maxLength} characters.`)
  .refine(
    (value) => countPasswordCharacterClasses(value) >= passwordPolicy.requiredCharacterClasses,
    `Include at least ${passwordPolicy.requiredCharacterClasses} of: ` +
      passwordPolicy.classes.map((entry) => entry.label).join(", ") +
      ".",
  )
  .refine((value) => !isCommonPassword(value), "Choose a password that is not a commonly used one.");

/**
 * Registration role. Deliberately a two-value literal union and not
 * `UserRole`: `ADMIN` is not self-assignable (BR-1, ARCHITECTURE.md §9).
 */
export const registrationRoleSchema = z.enum(
  ["CLIENT", "CONSULTANT"],
  "Choose whether you are looking for support or joining as a consultant.",
);

/**
 * `fullName` accepts 2–100 characters. Whitespace-only values are rejected
 * after trimming, and the trimmed value is what the service stores.
 */
const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(100, "Your name must be 100 characters or fewer.")
  .refine((value) => value.trim().length >= 2, "Enter your full name.");

/**
 * The IANA zone captured from the browser. An empty string is allowed because
 * a form submitted without JavaScript has not run the capture yet; the service
 * normalizes that to `UTC` (§19 timezone rules).
 */
const timezoneFieldSchema = z
  .string()
  .trim()
  .max(64, "That timezone is too long.")
  .refine(
    (value) => value === "" || ianaTimezoneSchema.safeParse(value).success,
    "Select a valid timezone.",
  );

/** A password confirmation pair, reported on the confirmation field. */
function attachPasswordConfirmation<T extends { password: string; confirmPassword: string }>(
  schema: z.ZodType<T>,
): z.ZodType<T> {
  return schema.superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two passwords do not match.",
      });
    }
  });
}

export const registerSchema = attachPasswordConfirmation(
  z
    .object({
      fullName: fullNameSchema,
      email: emailSchema,
      password: passwordFieldSchema,
      confirmPassword: z.string().min(1, "Repeat your password."),
      role: registrationRoleSchema,
      acceptTerms: z
        .boolean()
        .refine((value) => value === true, "Accept the terms of service to continue."),
      timezone: timezoneFieldSchema,
    })
    .superRefine((values, ctx) => {
      // A password containing the account's own address is guessable from
      // public information, so it is refused alongside the deny-list.
      const localPart = values.email.split("@")[0]?.toLowerCase() ?? "";
      if (localPart.length >= 4 && values.password.toLowerCase().includes(localPart)) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "Choose a password that does not contain your email address.",
        });
      }
    }),
);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const requestResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = attachPasswordConfirmation(
  z.object({
    token: z.string().trim().min(1, "This password reset link is incomplete."),
    password: passwordFieldSchema,
    confirmPassword: z.string().min(1, "Repeat your password."),
  }),
);

/**
 * Verification and reset links carry a base64url token of 32 bytes (43
 * characters). The bounds leave room for future encodings without accepting an
 * unbounded string into a database lookup.
 */
export const tokenParamSchema = z
  .string()
  .trim()
  .min(20, "This link is incomplete.")
  .max(200, "This link is not valid.");

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestResetInput = z.infer<typeof requestResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RegistrationRole = z.infer<typeof registrationRoleSchema>;

/**
 * Re-exported so callers assert "acceptable password" without importing the
 * strength meter, which exists for feedback rather than for enforcement.
 */
export { isPasswordAcceptable };
