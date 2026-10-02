import type { ZodError, ZodType } from "zod";
import { AppError, RateLimitError, ValidationError } from "@/server/errors";
import { fieldErrorsFromZodError } from "@/schemas/common";

/**
 * The shape every authentication form renders from (IMPLEMENTATION.md Step 4,
 * "Error handling").
 *
 * Server Actions return this instead of throwing at the client: the field-level
 * errors a form highlights, plus one message for the region above the form.
 * `status` distinguishes "we could not do that" from "we did that and here is
 * the confirmation", which the forms that do not redirect (verify, reset,
 * resend) rely on.
 */
export interface AuthFormState {
  status: "idle" | "error" | "success";
  message: string | null;
  fieldErrors: Record<string, string[]>;
}

export const initialAuthFormState: AuthFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

export function formError(
  message: string,
  fieldErrors: Record<string, string[]> = {},
): AuthFormState {
  return { status: "error", message, fieldErrors };
}

export function formSuccess(message: string): AuthFormState {
  return { status: "success", message, fieldErrors: {} };
}

/**
 * The parse both the action and this module share: shape problems come back as
 * field errors, never as a thrown error, so a malformed POST produces a
 * rendered form rather than a 500.
 */
export function parseForm<T>(
  schema: ZodType<T>,
  values: unknown,
): { ok: true; data: T } | { ok: false; state: AuthFormState } {
  const result = schema.safeParse(values);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    state: formError("Please check the highlighted fields.", zodFieldErrors(result.error)),
  };
}

function zodFieldErrors(error: ZodError): Record<string, string[]> {
  return fieldErrorsFromZodError(error);
}

/**
 * Reads a text field. Absent fields become `""` so the schema's own message is
 * what the person sees, instead of "expected string, received undefined".
 */
export function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Reads a checkbox. A checked box arrives as `"on"`; the forms that own a
 * controlled checkbox post `"on"`/`"off"` explicitly, and anything else is
 * false, so the schema decides rather than the transport.
 */
export function checkboxField(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true";
}

/** "15 minutes" / "1 minute" / "45 seconds" — a retry hint, not a timestamp. */
export function describeRetryAfter(seconds: number): string {
  if (seconds >= 120) {
    return `${Math.ceil(seconds / 60)} minutes`;
  }
  if (seconds >= 60) {
    return "1 minute";
  }
  return `${Math.max(1, seconds)} seconds`;
}

/**
 * Maps a service failure to form state. `RateLimitError` becomes an explicit
 * "try again in …" because a throttled person deserves to know why nothing
 * happened (§16); every other typed error keeps its own safe message and field
 * errors; anything unrecognised becomes one generic sentence, with the detail
 * left to the server log.
 */
export function toAuthFormState(error: unknown): AuthFormState {
  if (error instanceof RateLimitError) {
    return formError(
      `Too many attempts. Please try again in ${describeRetryAfter(error.retryAfter)}.`,
    );
  }

  if (error instanceof ValidationError) {
    return formError(error.safeMessage, error.fieldErrors ?? {});
  }

  if (error instanceof AppError) {
    return formError(error.safeMessage, error.fieldErrors ?? {});
  }

  return formError("Something went wrong on our side. Please try again.");
}

/**
 * The generic answer to registration and password-reset requests: identical
 * whether or not the address exists, so the response cannot be used to
 * enumerate accounts (§9 registration step 2, "Password reset").
 */
export const GENERIC_INBOX_MESSAGE =
  "If that address can be registered, we have sent a verification link. Check your inbox.";
