import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => {
  const harness = await import("@/tests/helpers/next-request");
  return { cookies: harness.createCookiesMock(), headers: harness.createHeadersMock() };
});

vi.mock("next/navigation", async () => {
  const harness = await import("@/tests/helpers/next-request");
  return harness.createNavigationMock();
});

vi.mock("next/cache", async () => {
  const harness = await import("@/tests/helpers/next-request");
  return harness.createCacheMock();
});

import { db } from "@/db/client";
import { initialAuthFormState } from "@/features/auth/form-state";
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resendVerificationAction,
  resetPasswordAction,
  verifyEmailAction,
} from "@/features/auth/actions";
import { getSession } from "@/server/auth/dal";
import { hashOpaqueToken } from "@/server/auth/tokens";
import { inspectAuthToken } from "@/server/services/auth";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import {
  captureRedirect,
  extractTokenFromLink,
  resetRequestState,
} from "@/tests/helpers/next-request";

/**
 * The single-use token flows: email verification and password reset
 * (IMPLEMENTATION.md Step 4, "Testing requirements": a consumed token is
 * rejected; reset consumes the token, changes the hash, and revokes all
 * sessions).
 *
 * The tokens are recovered from the queued `EmailOutbox` links, which is how a
 * real person receives them — the service never hands a raw token to its caller.
 */

const PASSWORD = "Correct-Horse-42";
const NEW_PASSWORD = "Another-Horse-77";

/**
 * Every test registers its own address. The reset limiter is keyed by address
 * (not by IP) so that one visitor cannot spend another's budget — which means
 * one shared address across tests would be throttled by the tests before it.
 */
let currentEmail = "dana1@example.com";
let emailCounter = 1;

function registerFormData(): FormData {
  const formData = new FormData();
  const values = {
    fullName: "Dana Klein",
    email: currentEmail,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    role: "CLIENT",
    acceptTerms: "on",
    timezone: "Europe/Berlin",
  };

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

function emailFormData(email: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

function tokenFormData(token: string): FormData {
  const formData = new FormData();
  formData.set("token", token);
  return formData;
}

function loginFormData(email: string, password: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

function resetFormData(token: string, password: string, confirm = password): FormData {
  const formData = new FormData();
  formData.set("token", token);
  formData.set("password", password);
  formData.set("confirmPassword", confirm);
  return formData;
}

/** The most recent queued mail of a template, and the token inside its link. */
async function latestEmailToken(template: string): Promise<string> {
  const email = await prisma.emailOutbox.findFirstOrThrow({
    where: { template },
    orderBy: { createdAt: "desc" },
  });

  const payload = email.payload as { link: string; expiresAt: string; fullName: string };
  return extractTokenFromLink(payload.link);
}

beforeAll(async () => {
  const [appDatabase] = await db.$queryRaw<Array<{ name: string }>>`
    SELECT current_database() AS name
  `;
  const [harnessDatabase] = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT current_database() AS name
  `;

  expect(appDatabase?.name).toBe(harnessDatabase?.name);
});

beforeEach(async () => {
  emailCounter += 1;
  currentEmail = `dana${emailCounter}@example.com`;
  resetRequestState();
  await cleanDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe("email verification", () => {
  it("consumes the link, sets emailVerifiedAt, and refuses a replay", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));
    const token = await latestEmailToken("auth.verify-email");

    expect(await inspectAuthToken(token, "EMAIL_VERIFICATION")).toMatchObject({
      status: "usable",
    });

    const state = await verifyEmailAction(initialAuthFormState, tokenFormData(token));
    expect(state.status).toBe("success");
    expect(state.message).toContain("verified");

    const user = await prisma.user.findUniqueOrThrow({ where: { email: currentEmail } });
    expect(user.emailVerifiedAt).not.toBeNull();

    const consumed = await prisma.verificationToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(consumed.consumedAt).not.toBeNull();
    expect(consumed.tokenHash).toBe(hashOpaqueToken(token));

    // The same link twice: the second attempt is refused, and no second token
    // was invented to satisfy it.
    const replay = await verifyEmailAction(initialAuthFormState, tokenFormData(token));
    expect(replay.status).toBe("error");
    expect(replay.message).toContain("expired or has already been used");
    expect(await inspectAuthToken(token, "EMAIL_VERIFICATION")).toEqual({ status: "invalid" });
  });

  it("refuses an expired link", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));
    const token = await latestEmailToken("auth.verify-email");

    await prisma.verificationToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const state = await verifyEmailAction(initialAuthFormState, tokenFormData(token));
    expect(state.status).toBe("error");
  });

  it("refuses a token that is not a verification token", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));
    const token = await latestEmailToken("auth.verify-email");

    await prisma.verificationToken.updateMany({ data: { type: "PASSWORD_RESET" } });

    const state = await verifyEmailAction(initialAuthFormState, tokenFormData(token));
    expect(state.status).toBe("error");
  });

  it("rejects a malformed token without touching the database", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    const state = await verifyEmailAction(initialAuthFormState, tokenFormData("too-short"));

    expect(state.status).toBe("error");
    expect(state.message).toContain("not valid");
    expect(await prisma.verificationToken.count({ where: { consumedAt: { not: null } } })).toBe(0);
  });

  it("reissues a link and invalidates the previous one", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));
    const first = await latestEmailToken("auth.verify-email");

    const resent = await resendVerificationAction(initialAuthFormState, new FormData());
    expect(resent.status).toBe("success");
    expect(resent.message).toContain("new verification link");

    const second = await latestEmailToken("auth.verify-email");
    expect(second).not.toBe(first);

    const stale = await verifyEmailAction(initialAuthFormState, tokenFormData(first));
    expect(stale.status).toBe("error");

    const fresh = await verifyEmailAction(initialAuthFormState, tokenFormData(second));
    expect(fresh.status).toBe("success");
  });

  it("reports an already-verified address instead of sending another link", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));
    const token = await latestEmailToken("auth.verify-email");
    await verifyEmailAction(initialAuthFormState, tokenFormData(token));

    const state = await resendVerificationAction(initialAuthFormState, new FormData());

    expect(state.status).toBe("success");
    expect(state.message).toContain("already verified");
  });

  it("refuses to resend for a signed-out caller", async () => {
    resetRequestState();
    const state = await resendVerificationAction(initialAuthFormState, new FormData());

    expect(state.status).toBe("error");
    expect(state.message).toContain("Sign in again");
  });
});


describe("password reset", () => {
  it("queues a reset link and answers identically for a known and an unknown address", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    resetRequestState("198.51.100.101");
    const known = await requestPasswordResetAction(
      initialAuthFormState,
      emailFormData(currentEmail),
    );

    resetRequestState("198.51.100.102");
    const unknown = await requestPasswordResetAction(
      initialAuthFormState,
      emailFormData("nobody@example.com"),
    );

    expect(known.status).toBe("success");
    expect(known).toEqual(unknown);
    expect(await prisma.emailOutbox.count({ where: { template: "auth.reset-password" } })).toBe(1);
  });

  it("consumes the token, changes the hash, and signs every device out", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    resetRequestState("198.51.100.110");
    await requestPasswordResetAction(initialAuthFormState, emailFormData(currentEmail));
    const token = await latestEmailToken("auth.reset-password");

    const state = await resetPasswordAction(
      initialAuthFormState,
      resetFormData(token, NEW_PASSWORD),
    );

    expect(state.status).toBe("success");
    expect(state.message).toContain("password has been changed");

    const user = await prisma.user.findUniqueOrThrow({ where: { email: currentEmail } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0);
    expect(await getSession()).toBeNull();

    const consumed = await prisma.verificationToken.findFirstOrThrow({
      where: { type: "PASSWORD_RESET" },
    });
    expect(consumed.consumedAt).not.toBeNull();
    expect(consumed.tokenHash).toBe(hashOpaqueToken(token));

    // The "your password changed" notification is queued as well.
    expect(await prisma.emailOutbox.count({ where: { template: "auth.password-changed" } })).toBe(1);
  });

  it("accepts the new password and refuses the old one", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    resetRequestState("198.51.100.120");
    await requestPasswordResetAction(initialAuthFormState, emailFormData(currentEmail));
    const token = await latestEmailToken("auth.reset-password");
    await resetPasswordAction(initialAuthFormState, resetFormData(token, NEW_PASSWORD));

    resetRequestState("198.51.100.121");
    const withNew = await captureRedirect(() =>
      loginAction(initialAuthFormState, loginFormData(currentEmail, NEW_PASSWORD)),
    );
    expect(withNew).toBe("/");

    resetRequestState("198.51.100.122");
    const withOld = await loginAction(
      initialAuthFormState,
      loginFormData(currentEmail, PASSWORD),
    );
    expect(withOld.status).toBe("error");
    expect(withOld.message).toBe("That email address and password do not match an account.");
  });
});


describe("password reset edge cases", () => {
  it("refuses a consumed reset token", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    resetRequestState("198.51.100.130");
    await requestPasswordResetAction(initialAuthFormState, emailFormData(currentEmail));
    const token = await latestEmailToken("auth.reset-password");

    await resetPasswordAction(initialAuthFormState, resetFormData(token, NEW_PASSWORD));
    const replay = await resetPasswordAction(
      initialAuthFormState,
      resetFormData(token, "Third-Horse-88"),
    );

    expect(replay.status).toBe("error");
    expect(replay.message).toContain("expired or has already been used");
  });

  it("invalidates an earlier link as soon as a new one is requested", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    resetRequestState("198.51.100.140");
    await requestPasswordResetAction(initialAuthFormState, emailFormData(currentEmail));
    const first = await latestEmailToken("auth.reset-password");

    resetRequestState("198.51.100.141");
    await requestPasswordResetAction(initialAuthFormState, emailFormData(currentEmail));
    const second = await latestEmailToken("auth.reset-password");

    expect(second).not.toBe(first);

    const stale = await resetPasswordAction(initialAuthFormState, resetFormData(first, NEW_PASSWORD));
    expect(stale.status).toBe("error");

    const fresh = await resetPasswordAction(
      initialAuthFormState,
      resetFormData(second, NEW_PASSWORD),
    );
    expect(fresh.status).toBe("success");
  });

  it("refuses an expired reset link", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    resetRequestState("198.51.100.150");
    await requestPasswordResetAction(initialAuthFormState, emailFormData(currentEmail));
    const token = await latestEmailToken("auth.reset-password");

    await prisma.verificationToken.updateMany({
      where: { type: "PASSWORD_RESET" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const state = await resetPasswordAction(
      initialAuthFormState,
      resetFormData(token, NEW_PASSWORD),
    );
    expect(state.status).toBe("error");
    expect(state.message).toContain("expired or has already been used");
  });

  it("reports the field-level shape errors a reset form must highlight", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    resetRequestState("198.51.100.160");
    await requestPasswordResetAction(initialAuthFormState, emailFormData(currentEmail));
    const token = await latestEmailToken("auth.reset-password");

    const mismatch = await resetPasswordAction(
      initialAuthFormState,
      resetFormData(token, NEW_PASSWORD, "Different-Horse-11"),
    );
    expect(mismatch.status).toBe("error");
    expect(mismatch.fieldErrors.confirmPassword?.[0]).toBe("The two passwords do not match.");

    const weak = await resetPasswordAction(
      initialAuthFormState,
      resetFormData(token, "alllowercaseonly"),
    );
    expect(weak.status).toBe("error");
    expect(weak.fieldErrors.password?.join(" ")).toContain("at least 3 of");
  });

  it("rate-limits reset requests per address", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    resetRequestState("198.51.100.170");
    const states = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      states.push(
        await requestPasswordResetAction(initialAuthFormState, emailFormData(currentEmail)),
      );
    }

    expect(states[2].status).toBe("success");
    expect(states[3].status).toBe("error");
    expect(states[3].message).toContain("Too many attempts");
  });
});

