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

import { env } from "@/config/env";
import { db } from "@/db/client";
import { initialAuthFormState, type AuthFormState } from "@/features/auth/form-state";
import {
  loginAction,
  logoutAction,
  logoutAllAction,
  registerAction,
  resendVerificationAction,
} from "@/features/auth/actions";
import { getCurrentUser, getSession } from "@/server/auth/dal";
import { hashOpaqueToken } from "@/server/auth/tokens";
import { registerUser } from "@/server/services/auth";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import {
  captureRedirect,
  extractTokenFromLink,
  latestCookieWrite,
  readRequestCookie,
  requestState,
  resetRequestState,
} from "@/tests/helpers/next-request";

/**
 * The authentication flows, driven through the real Server Actions and the real
 * services against the dedicated test database (IMPLEMENTATION.md Step 4,
 * "Testing requirements", integration list). Only the *request* is faked: the
 * cookie jar, the headers, and the redirect/revalidate calls.
 */

const PASSWORD = "Correct-Horse-42";

function registerFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values = {
    fullName: "Dana Klein",
    email: "dana@example.com",
    password: PASSWORD,
    confirmPassword: PASSWORD,
    role: "CLIENT",
    acceptTerms: "on",
    timezone: "Europe/Berlin",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

function loginFormData(email: string, password: string, next?: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);

  if (next !== undefined) {
    formData.set("next", next);
  }

  return formData;
}

async function countRows(
  table: "User" | "Session" | "ClientProfile" | "VerificationToken" | "EmailOutbox" | "ConsultantProfile",
): Promise<number> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM "${table}"`,
  );

  return Number(row?.count ?? 0);
}

beforeAll(async () => {
  // The services write through `@/db/client` while the assertions read through
  // the test harness. If those ever resolved to different databases, half of
  // these tests would pass for the wrong reason, so it is asserted up front.
  const [appDatabase] = await db.$queryRaw<Array<{ name: string }>>`
    SELECT current_database() AS name
  `;
  const [harnessDatabase] = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT current_database() AS name
  `;

  expect(appDatabase?.name).toBe(harnessDatabase?.name);
});

beforeEach(async () => {
  resetRequestState();
  await cleanDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe("registration", () => {
  it("writes the user, the client profile, the token and the queued email, then signs the person in", async () => {
    const redirectTo = await captureRedirect(() =>
      registerAction(initialAuthFormState, registerFormData()),
    );

    expect(redirectTo).toBe("/");

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "dana@example.com" },
      include: { clientProfile: true },
    });

    expect(user.role).toBe("CLIENT");
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.status).toBe("ACTIVE");
    expect(user.timezone).toBe("Europe/Berlin");
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.clientProfile?.displayName).toBe("Dana");

    const token = await prisma.verificationToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(token.type).toBe("EMAIL_VERIFICATION");
    expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(token.consumedAt).toBeNull();
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const email = await prisma.emailOutbox.findFirstOrThrow({ where: { userId: user.id } });
    expect(email.template).toBe("auth.verify-email");
    expect(email.status).toBe("PENDING");
    const payload = email.payload as { link: string; expiresAt: string; fullName: string };
    expect(extractTokenFromLink(payload.link)).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect(await countRows("Session")).toBe(1);
  });

  it("normalises the address and falls back to UTC when the browser sent no timezone", async () => {
    await captureRedirect(() =>
      registerAction(
        initialAuthFormState,
        registerFormData({ email: "  Dana@Example.COM ", timezone: "" }),
      ),
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "dana@example.com" } });
    expect(user.email).toBe("dana@example.com");
    expect(user.timezone).toBe("UTC");
  });

  it("sets an httpOnly, lax, root-scoped cookie whose token is stored only as a hash", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    const cookie = latestCookieWrite();
    expect(cookie?.name).toBe(env.SESSION_COOKIE_NAME);
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie?.options?.expires).toBeInstanceOf(Date);

    const rawToken = cookie!.value;
    const session = await prisma.session.findFirstOrThrow();

    expect(session.tokenHash).toBe(hashOpaqueToken(rawToken));
    expect(session.tokenHash).not.toBe(rawToken);
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("answers a duplicate address generically and creates nothing", async () => {
    await captureRedirect(() => registerAction(initialAuthFormState, registerFormData()));

    resetRequestState();
    const state = await registerAction(initialAuthFormState, registerFormData());

    expect(state.status).toBe("success");
    expect(state.message).toContain("If that address can be registered");

    expect(await countRows("User")).toBe(1);
    expect(await countRows("ClientProfile")).toBe(1);
    expect(await countRows("VerificationToken")).toBe(1);
    expect(await countRows("EmailOutbox")).toBe(1);
  });

  it("rolls the whole registration back when two requests race for the same address", async () => {
    resetRequestState("198.51.100.4");
    const attempt = () =>
      registerUser(
        {
          fullName: "Racing Person",
          email: "race@example.com",
          password: PASSWORD,
          confirmPassword: PASSWORD,
          role: "CLIENT",
          acceptTerms: true,
          timezone: "UTC",
        },
        { ipAddress: "198.51.100.4", ipHash: hashOpaqueToken("198.51.100.4"), userAgent: "vitest" },
      );

    const outcomes = await Promise.all([attempt(), attempt()]);
    const statuses = outcomes.map((outcome) => outcome.status).sort();

    expect(statuses).toEqual(["already_registered", "created"]);
    expect(await countRows("User")).toBe(1);
    expect(await countRows("ClientProfile")).toBe(1);
    expect(await countRows("VerificationToken")).toBe(1);
    expect(await countRows("EmailOutbox")).toBe(1);
  });

  it("does not create a consultant profile with placeholder values", async () => {
    // Step 8 creates the professional profile: its price, biography, duration,
    // and consultation types have no honest default at registration.
    await captureRedirect(() =>
      registerAction(initialAuthFormState, registerFormData({ role: "CONSULTANT" })),
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "dana@example.com" } });
    expect(user.role).toBe("CONSULTANT");
    expect(await countRows("ConsultantProfile")).toBe(0);
  });
});


const GENERIC_LOGIN_MESSAGE = "That email address and password do not match an account.";

async function registerClient(email = "dana@example.com"): Promise<string> {
  resetRequestState();
  await captureRedirect(() =>
    registerAction(initialAuthFormState, registerFormData({ email })),
  );
  return email;
}

describe("sign-in", () => {
  it("writes a session, sets the cookie, and lands on the home page", async () => {
    await registerClient();
    await prisma.session.deleteMany();

    const redirectTo = await captureRedirect(() =>
      loginAction(initialAuthFormState, loginFormData("dana@example.com", PASSWORD)),
    );

    expect(redirectTo).toBe("/");
    expect(await countRows("Session")).toBe(1);

    const session = await prisma.session.findFirstOrThrow();
    expect(session.revokedAt).toBeNull();
    expect(session.lastUsedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(session.tokenHash).toBe(hashOpaqueToken(latestCookieWrite()!.value));
  });

  it("returns the person to a validated next path and refuses an off-site one", async () => {
    await registerClient();

    const allowed = await captureRedirect(() =>
      loginAction(initialAuthFormState, loginFormData("dana@example.com", PASSWORD, "/consultants")),
    );
    expect(allowed).toBe("/consultants");

    const refused = await captureRedirect(() =>
      loginAction(
        initialAuthFormState,
        loginFormData("dana@example.com", PASSWORD, "//evil.example.com"),
      ),
    );
    expect(refused).toBe("/");
  });

  it("answers an unknown address, a wrong password, and a locked account identically", async () => {
    await registerClient();

    resetRequestState("198.51.100.21");
    const unknown = await loginAction(
      initialAuthFormState,
      loginFormData("nobody@example.com", PASSWORD),
    );

    resetRequestState("198.51.100.22");
    const wrongPassword = await loginAction(
      initialAuthFormState,
      loginFormData("dana@example.com", "Wrong-Horse-99"),
    );

    await prisma.user.updateMany({
      where: { email: "dana@example.com" },
      data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000), failedLoginCount: 10 },
    });

    resetRequestState("198.51.100.23");
    const locked = await loginAction(
      initialAuthFormState,
      loginFormData("dana@example.com", PASSWORD),
    );

    expect(unknown).toEqual({ status: "error", message: GENERIC_LOGIN_MESSAGE, fieldErrors: {} });
    expect(wrongPassword).toEqual(unknown);
    expect(locked).toEqual(unknown);
    expect(await countRows("Session")).toBe(1);
  });

  it("locks the account on the tenth consecutive failure and keeps it locked", async () => {
    await registerClient();

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      resetRequestState(`198.51.100.${attempt + 30}`);
      const state = await loginAction(
        initialAuthFormState,
        loginFormData("dana@example.com", "Wrong-Horse-99"),
      );

      expect(state.message).toBe(GENERIC_LOGIN_MESSAGE);
    }

    const locked = await prisma.user.findUniqueOrThrow({ where: { email: "dana@example.com" } });
    expect(locked.failedLoginCount).toBe(10);
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Even the correct password is refused while the lock holds, and the answer
    // is still the generic one.
    resetRequestState("198.51.100.44");
    const state = await loginAction(
      initialAuthFormState,
      loginFormData("dana@example.com", PASSWORD),
    );

    expect(state.message).toBe(GENERIC_LOGIN_MESSAGE);
  });

  it("increments the failure counter and resets it on the next success", async () => {
    await registerClient();

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      resetRequestState(`198.51.100.${attempt + 60}`);
      await loginAction(initialAuthFormState, loginFormData("dana@example.com", "Wrong-Horse-99"));
    }

    const afterFailures = await prisma.user.findUniqueOrThrow({
      where: { email: "dana@example.com" },
    });
    expect(afterFailures.failedLoginCount).toBe(2);

    resetRequestState("198.51.100.63");
    await captureRedirect(() =>
      loginAction(initialAuthFormState, loginFormData("dana@example.com", PASSWORD)),
    );

    const afterSuccess = await prisma.user.findUniqueOrThrow({
      where: { email: "dana@example.com" },
    });
    expect(afterSuccess.failedLoginCount).toBe(0);
    expect(afterSuccess.lockedUntil).toBeNull();
  });
});


describe("session lifecycle", () => {
  it("resolves the signed-in user and reports no session without a valid cookie", async () => {
    await registerClient();

    expect((await getSession())?.user.email).toBe("dana@example.com");
    expect((await getCurrentUser())?.email).toBe("dana@example.com");

    resetRequestState();
    expect(await getSession()).toBeNull();
    expect(await getCurrentUser()).toBeNull();

    requestState.cookies.set(env.SESSION_COOKIE_NAME, "a-forged-token-that-was-never-issued");
    expect(await getSession()).toBeNull();
  });

  it("returns the account status so a suspension can be explained rather than hidden", async () => {
    await registerClient();
    await prisma.user.updateMany({
      where: { email: "dana@example.com" },
      data: { status: "SUSPENDED" },
    });

    expect((await getCurrentUser())?.status).toBe("SUSPENDED");
  });

  it("signs the browser out on its very next request once the session row is deleted", async () => {
    await registerClient();

    const session = await prisma.session.findFirstOrThrow();
    await prisma.session.delete({ where: { id: session.id } });

    expect(await getSession()).toBeNull();
    expect(await getCurrentUser()).toBeNull();
  });

  it("extends both the row and the cookie after the renewal threshold", async () => {
    await registerClient();

    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await prisma.session.updateMany({ data: { lastUsedAt: stale } });

    const before = await prisma.session.findFirstOrThrow();
    const previousToken = readRequestCookie(env.SESSION_COOKIE_NAME)!;
    const writesBefore = requestState.cookieWrites.length;

    const state = await resendVerificationAction(initialAuthFormState, new FormData());
    expect(state.status).toBe("success");

    const after = await prisma.session.findFirstOrThrow();
    expect(after.id).toBe(before.id);
    expect(after.lastUsedAt.getTime()).toBeGreaterThan(stale.getTime());
    expect(after.expiresAt.getTime()).toBeGreaterThan(before.expiresAt.getTime());

    // The cookie is re-issued with a rotated token, and the stored hash follows it.
    expect(requestState.cookieWrites.length).toBeGreaterThan(writesBefore);
    const renewed = latestCookieWrite()!;
    expect(renewed.value).not.toBe(previousToken);
    expect(after.tokenHash).toBe(hashOpaqueToken(renewed.value));
    expect(readRequestCookie(env.SESSION_COOKIE_NAME)).toBe(renewed.value);

    // The rotated token is the one that authenticates from now on.
    expect((await getSession())?.session.id).toBe(before.id);
  });

  it("leaves a recently used session alone", async () => {
    await registerClient();

    const writesBefore = requestState.cookieWrites.length;
    await resendVerificationAction(initialAuthFormState, new FormData());

    expect(requestState.cookieWrites.length).toBe(writesBefore);
  });

  it("revokes the current session and clears the cookie on sign-out", async () => {
    await registerClient();

    const redirectTo = await captureRedirect(() => logoutAction());

    expect(redirectTo).toBe("/");
    const session = await prisma.session.findFirstOrThrow();
    expect(session.revokedAt).not.toBeNull();
    expect(requestState.cookieDeletes).toContain(env.SESSION_COOKIE_NAME);
    expect(readRequestCookie(env.SESSION_COOKIE_NAME)).toBeUndefined();
    expect(await getSession()).toBeNull();
  });

  it("revokes every session of the account on sign out everywhere", async () => {
    await registerClient();

    resetRequestState();
    await captureRedirect(() =>
      loginAction(initialAuthFormState, loginFormData("dana@example.com", PASSWORD)),
    );

    expect(await countRows("Session")).toBe(2);

    const redirectTo = await captureRedirect(() => logoutAllAction());

    expect(redirectTo).toBe("/");
    const live = await prisma.session.count({ where: { revokedAt: null } });
    expect(live).toBe(0);
    expect(await getSession()).toBeNull();
  });
});

describe("rate limits", () => {
  it("refuses the sixth registration from one address with a retry hint", async () => {
    resetRequestState("203.0.113.200");

    // A successful registration redirects, so only a throttled attempt — the
    // one that returns a state instead of navigating — is observable here.
    const returnedStates: AuthFormState[] = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await captureRedirect(async () => {
        returnedStates.push(
          await registerAction(
            initialAuthFormState,
            registerFormData({ email: `person-${attempt}@example.com` }),
          ),
        );
      });
    }

    expect(returnedStates).toHaveLength(1);
    expect(returnedStates[0].status).toBe("error");
    expect(returnedStates[0].message).toContain("Too many attempts");
    expect(returnedStates[0].message).toMatch(/try again in/i);
    expect(await countRows("User")).toBe(5);
  });

  it("refuses repeated sign-in attempts for one address and email with a retry hint", async () => {
    await registerClient();

    resetRequestState("203.0.113.210");
    const states = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      states.push(
        await loginAction(
          initialAuthFormState,
          loginFormData("dana@example.com", "Wrong-Horse-99"),
        ),
      );
    }

    expect(states[5].message).toContain("Too many attempts");
    expect(states[5].message).toMatch(/try again in/i);
    // Six attempts, six messages, none of which was ever the generic refusal:
    // the throttle is honest about being a throttle.
    expect(states[4].message).toBe(GENERIC_LOGIN_MESSAGE);
  });
});

