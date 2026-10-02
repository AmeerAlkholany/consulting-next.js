"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GENERIC_INBOX_MESSAGE } from "@/features/auth/form-state";
import {
  SIGNED_IN_LANDING_PATH,
  safeRedirectPath,
} from "@/lib/redirects";
import { loginSchema, registerSchema, requestResetSchema, resetPasswordSchema, tokenParamSchema } from "@/schemas/auth";
import { getSession } from "@/server/auth/dal";
import { readAuthRequestContext } from "@/server/auth/request-context";
import { clearSessionCookie, writeSessionCookie } from "@/server/auth/session";
import {
  endAllSessions,
  endSession,
  loginUser,
  registerUser,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  touchSession,
  verifyEmailAddress,
} from "@/server/services/auth";
import { logger } from "@/server/logger";
import {
  checkboxField,
  formError,
  formSuccess,
  parseForm,
  textField,
  toAuthFormState,
  type AuthFormState,
} from "@/features/auth/form-state";

/**
 * The authentication Server Actions (IMPLEMENTATION.md Step 4, "API changes").
 *
 * Thin by design (ARCHITECTURE.md §4): parse → call one service function → map
 * the result → write the cookie → redirect. No Prisma, no domain branching, and
 * no `redirect()` inside a `try` block — it throws, and catching it would turn
 * a navigation into a rendered error.
 *
 * `/api/auth/*` deliberately does not exist: these actions are the only
 * authentication surface, so there is no second path to keep in sync.
 */

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(registerSchema, {
    fullName: textField(formData, "fullName"),
    email: textField(formData, "email"),
    password: textField(formData, "password"),
    confirmPassword: textField(formData, "confirmPassword"),
    role: textField(formData, "role"),
    acceptTerms: checkboxField(formData, "acceptTerms"),
    timezone: textField(formData, "timezone"),
  });

  if (!parsed.ok) {
    return parsed.state;
  }

  const context = await readAuthRequestContext();

  try {
    const outcome = await registerUser(parsed.data, context);

    if (outcome.status === "already_registered") {
      // Same sentence and same shape as a fresh registration; the account state
      // is not disclosed.
      return formSuccess(GENERIC_INBOX_MESSAGE);
    }

    await writeSessionCookie(outcome.session.cookie);
  } catch (error) {
    return toAuthFormState(error);
  }

  revalidatePath("/", "layout");
  redirect(SIGNED_IN_LANDING_PATH);
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(loginSchema, {
    email: textField(formData, "email"),
    password: textField(formData, "password"),
  });

  if (!parsed.ok) {
    return parsed.state;
  }

  // `?next=` is attacker-controlled: it is validated as a same-origin relative
  // path before it is used, so the sign-in page cannot be turned into an open
  // redirect (§10, §16).
  const destination = safeRedirectPath(textField(formData, "next"), SIGNED_IN_LANDING_PATH);
  const context = await readAuthRequestContext();

  try {
    const outcome = await loginUser(parsed.data, context);

    if (outcome.status === "invalid_credentials") {
      // One sentence for a wrong password, an unknown address, and a locked
      // account alike.
      return formError("That email address and password do not match an account.");
    }

    await writeSessionCookie(outcome.session.cookie);
  } catch (error) {
    return toAuthFormState(error);
  }

  revalidatePath("/", "layout");
  // `typedRoutes` validates literal hrefs; this one is computed, and the cast is
  // what `safeRedirectPath` above exists to make safe.
  redirect(destination as Route);
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();

  if (session) {
    await endSession(session.session.id);
  }

  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect(SIGNED_IN_LANDING_PATH);
}

export async function logoutAllAction(): Promise<void> {
  const session = await getSession();

  if (session) {
    await endAllSessions(session.user.id);
  }

  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect(SIGNED_IN_LANDING_PATH);
}

/** Referenced by the logout failure path so a broken sign-out is visible. */
function logActionFailure(action: string, error: unknown): void {
  logger.error({ action, err: error }, "authentication action failed");
}

export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(requestResetSchema, { email: textField(formData, "email") });

  if (!parsed.ok) {
    return parsed.state;
  }

  const context = await readAuthRequestContext();

  try {
    await requestPasswordReset(parsed.data, context);
  } catch (error) {
    // A rate-limit trip is worth reporting; every other failure is deliberately
    // invisible, because distinguishing them would enumerate accounts.
    if (!(error instanceof Error)) {
      logActionFailure("requestPasswordReset", error);
    }
    return toAuthFormState(error);
  }

  return formSuccess(GENERIC_INBOX_MESSAGE);
}

export async function resetPasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(resetPasswordSchema, {
    token: textField(formData, "token"),
    password: textField(formData, "password"),
    confirmPassword: textField(formData, "confirmPassword"),
  });

  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    const outcome = await resetPassword(parsed.data);

    if (outcome.status === "invalid_token") {
      return formError(
        "This password reset link has expired or has already been used. Request a new one.",
      );
    }
  } catch (error) {
    logActionFailure("resetPassword", error);
    return toAuthFormState(error);
  }

  // Every session was revoked by the reset, so the confirmation is the only
  // thing this browser may see; the form offers a link to sign in again.
  return formSuccess("Your password has been changed. Sign in with it to continue.");
}

export async function verifyEmailAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(tokenParamSchema, textField(formData, "token"));

  if (!parsed.ok) {
    return formError("This verification link is not valid. Request a new one from your account.");
  }

  try {
    const outcome = await verifyEmailAddress(parsed.data);

    if (outcome.status === "invalid_token") {
      return formError(
        "This verification link has expired or has already been used. Request a new one.",
      );
    }
  } catch (error) {
    logActionFailure("verifyEmail", error);
    return toAuthFormState(error);
  }

  // The banner and the user menu both read the session, so the shell is told to
  // re-render without a redirect: the person stays on the page that confirms it.
  revalidatePath("/", "layout");

  return formSuccess("Your email address is verified. You can book and be booked.");
}

export async function resendVerificationAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: AuthFormState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<AuthFormState> {
  const session = await getSession();

  if (!session) {
    return formError("Sign in again to request a new verification link.");
  }

  try {
    const outcome = await resendEmailVerification(session.user.id);

    if (outcome.status === "already_verified") {
      return formSuccess("Your email address is already verified.");
    }

    // Sliding renewal (§9) happens here, in an action, because it writes a
    // cookie and Next.js forbids that during render.
    const renewed = await touchSession(session.session);

    if (renewed) {
      await writeSessionCookie(renewed);
    }
  } catch (error) {
    return toAuthFormState(error);
  }

  return formSuccess("We have sent a new verification link. Check your inbox.");
}

