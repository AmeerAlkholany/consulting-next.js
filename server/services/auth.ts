import "server-only";

import { db } from "@/db/client";
import { env } from "@/config/env";
import { authRateLimits, verificationTokenPolicy } from "@/config/security";
import { evaluateLockout, registerFailedLogin, type SessionCookieDescriptor } from "@/lib/auth-policy";
import type {
  LoginInput,
  RegisterInput,
  RequestResetInput,
  ResetPasswordInput,
} from "@/schemas/auth";
import { createRateLimiter, type RateLimiter } from "@/server/rate-limit";
import { hashPassword, runDummyPasswordComparison, verifyPassword } from "@/server/auth/password";
import type { AuthRequestContext } from "@/server/auth/request-context";
import {
  createSession,
  renewSessionIfStale,
  revokeSession,
  type IssuedSession,
  type SessionRecord,
  type SessionUser,
} from "@/server/auth/session";
import { generateOpaqueToken, hashOpaqueToken } from "@/server/auth/tokens";
import { RateLimitError } from "@/server/errors";
import { logger } from "@/server/logger";

/**
 * The authentication domain (ARCHITECTURE.md §9).
 *
 * Everything in this module is a domain rule — what registration writes in one
 * transaction, when a login is refused, how a reset consumes its token — and
 * everything it returns is a value (`…Outcome`) or a typed `AppError`. It never
 * touches a cookie jar, never redirects, and never reads `searchParams`: the
 * Server Actions in `features/auth/actions.ts` do that part, which is also what
 * lets the integration suite drive these rules directly.
 *
 * Rate limits are consumed before any database read, so a throttled caller
 * cannot use response time to probe for accounts (§16).
 */

/**
 * The client Prisma hands to an interactive-transaction callback: the same
 * delegate surface as `db`, without the connection and transaction controls.
 */
export type TransactionClient = Omit<
  typeof db,
  "$transaction" | "$connect" | "$disconnect" | "$on" | "$extends"
>;

export const DEFAULT_TIMEZONE = "UTC";

const limiters: Record<keyof typeof authRateLimits, RateLimiter> = {
  loginPerIpAndEmail: createRateLimiter(authRateLimits.loginPerIpAndEmail),
  loginPerIp: createRateLimiter(authRateLimits.loginPerIp),
  registerPerIp: createRateLimiter(authRateLimits.registerPerIp),
  passwordResetPerEmail: createRateLimiter(authRateLimits.passwordResetPerEmail),
  passwordResetPerIp: createRateLimiter(authRateLimits.passwordResetPerIp),
  resendVerificationPerUser: createRateLimiter(authRateLimits.resendVerificationPerUser),
  discoverySearch: createRateLimiter(authRateLimits.discoverySearch),
};

/** Emails are stored and compared lowercase-normalized (§9 registration step 2). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeTimezone(timezone: string): string {
  return timezone.trim() === "" ? DEFAULT_TIMEZONE : timezone.trim();
}

/** What a consultant sees as a client's name: the first word of their full name. */
function displayNameFrom(fullName: string): string {
  const [first] = fullName.trim().split(/\s+/);
  return (first ?? fullName).slice(0, 100);
}

async function enforceRateLimit(limiter: RateLimiter, key: string, scope: string): Promise<void> {
  const result = await limiter.consume(key);

  if (result.allowed) {
    return;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  // The scope is logged, never the key: a key contains an email hash or an
  // address hash, and §17 keeps both out of log lines.
  logger.warn({ scope, retryAfterSeconds }, "authentication rate limit tripped");
  throw new RateLimitError(retryAfterSeconds);
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function verificationLink(token: string): string {
  return `${env.APP_URL}/verify-email/${token}`;
}

function passwordResetLink(token: string): string {
  return `${env.APP_URL}/reset-password/${token}`;
}

/**
 * The outbox is written from day one (§20); delivery arrives in Step 18. Until
 * then a development-only log line prints the link so the flow is walkable
 * end-to-end without an email provider. Never in production, and never with the
 * recipient's address (§17).
 */
function logDevelopmentEmail(purpose: string, link: string): void {
  if (env.NODE_ENV === "production") {
    return;
  }

  logger.info({ purpose, link }, "development email link (queued in EmailOutbox)");
}

async function queueAuthEmail(
  tx: TransactionClient,
  message: {
    userId: string;
    toEmail: string;
    template: "auth.verify-email" | "auth.reset-password" | "auth.password-changed";
    payload: Record<string, string>;
  },
): Promise<void> {
  await tx.emailOutbox.create({
    data: {
      userId: message.userId,
      toEmail: message.toEmail,
      template: message.template,
      payload: message.payload,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Registration                                                               */
/* -------------------------------------------------------------------------- */

export type RegisterOutcome =
  | {
      status: "created";
      user: SessionUser;
      session: IssuedSession;
      /** The raw verification token, returned so the caller can log it in development. */
      verificationToken: string;
    }
  | { status: "already_registered" };

function toSessionUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: SessionUser["role"];
  status: SessionUser["status"];
  emailVerifiedAt: Date | null;
  timezone: string;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    timezone: user.timezone,
  };
}

/**
 * Registration (§9 "Registration").
 *
 * The user row, the client profile, the verification token, and the queued mail
 * are written in one transaction: a failure at any point leaves no half-built
 * account behind. The session is created after that transaction commits — a
 * session is disposable and re-creatable, whereas a partially written account
 * is not.
 *
 * A duplicate address returns the same generic outcome as a fresh registration
 * (`already_registered`) and writes nothing, so the response cannot be used to
 * enumerate accounts.
 */
export async function registerUser(
  input: RegisterInput,
  context: AuthRequestContext,
): Promise<RegisterOutcome> {
  await enforceRateLimit(limiters.registerPerIp, context.ipHash, "register.per_ip");

  const email = normalizeEmail(input.email);
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    logger.warn({ userId: existing.id }, "registration attempted for an existing address");
    return { status: "already_registered" };
  }

  const passwordHash = await hashPassword(input.password);
  const verificationToken = generateOpaqueToken();
  const verificationExpiresAt = new Date(
    Date.now() + verificationTokenPolicy.emailVerificationTtlMs,
  );

  let created: SessionUser;

  try {
    created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName: input.fullName,
          role: input.role,
          timezone: normalizeTimezone(input.timezone),
          // A client's profile exists from the moment the account does, because
          // every booking and review hangs off it. A consultant's professional
          // profile is created when they fill it in (Step 8): its price, bio,
          // duration, and consultation types have no honest default, and the
          // schema refuses a placeholder (§8.2).
          ...(input.role === "CLIENT"
            ? { clientProfile: { create: { displayName: displayNameFrom(input.fullName) } } }
            : {}),
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          timezone: true,
        },
      });

      await tx.verificationToken.create({
        data: {
          userId: user.id,
          type: "EMAIL_VERIFICATION",
          tokenHash: hashOpaqueToken(verificationToken),
          expiresAt: verificationExpiresAt,
        },
      });

      await queueAuthEmail(tx, {
        userId: user.id,
        toEmail: user.email,
        template: "auth.verify-email",
        payload: {
          link: verificationLink(verificationToken),
          expiresAt: verificationExpiresAt.toISOString(),
          fullName: user.fullName,
        },
      });

      return toSessionUser(user);
    });
  } catch (error) {
    // Two registrations for the same address can pass the check above and race
    // to the unique index; the loser rolls back and reports the generic outcome.
    if (isUniqueConstraintViolation(error)) {
      logger.warn({}, "registration lost a race for the same address");
      return { status: "already_registered" };
    }
    throw error;
  }

  const session = await createSession(created.id, {
    ipHash: context.ipHash,
    userAgent: context.userAgent,
  });

  logDevelopmentEmail("verify-email", verificationLink(verificationToken));
  logger.info({ userId: created.id, role: created.role }, "account registered");

  return { status: "created", user: created, session, verificationToken };
}

/* -------------------------------------------------------------------------- */
/* Login, sessions, sign-out                                                  */
/* -------------------------------------------------------------------------- */

export type LoginOutcome =
  | { status: "authenticated"; user: SessionUser; session: IssuedSession }
  /** Unknown address, wrong password, or a locked account: one identical answer. */
  | { status: "invalid_credentials" };

/**
 * Login (§9 "Login").
 *
 * Three properties matter more than the happy path. First, the work is
 * constant: every failure path — an unknown account included — performs exactly
 * one Argon2id verification, so response time does not reveal whether an
 * address is registered. Second, every failure returns the same
 * `invalid_credentials` outcome, so a locked account is indistinguishable from
 * a wrong password. Third, the failure counter lives in the database rather
 * than in memory, so it survives a restart and is shared across instances.
 */
export async function loginUser(
  input: LoginInput,
  context: AuthRequestContext,
): Promise<LoginOutcome> {
  const email = normalizeEmail(input.email);

  await enforceRateLimit(
    limiters.loginPerIpAndEmail,
    `${context.ipHash}:${hashOpaqueToken(email)}`,
    "login.per_ip_email",
  );
  await enforceRateLimit(limiters.loginPerIp, context.ipHash, "login.per_ip");

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      timezone: true,
      emailVerifiedAt: true,
      passwordHash: true,
      failedLoginCount: true,
      lockedUntil: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt !== null) {
    await runDummyPasswordComparison(input.password);
    logger.warn({ ipHash: context.ipHash }, "login refused: no matching active account");
    return { status: "invalid_credentials" };
  }

  const lockout = evaluateLockout(user);

  if (lockout.isLocked) {
    // The refusal is deliberately worded and shaped like a wrong password. The
    // lock itself is a server-side fact; telling the caller about it would let
    // anyone confirm that an address is registered by locking it out.
    await runDummyPasswordComparison(input.password);
    logger.warn(
      { userId: user.id, lockedUntil: lockout.lockedUntil?.toISOString() },
      "login refused: account locked",
    );
    return { status: "invalid_credentials" };
  }

  const passwordMatches = await verifyPassword(user.passwordHash, input.password);

  if (!passwordMatches) {
    const failure = registerFailedLogin(user);
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: failure.failedLoginCount, lockedUntil: failure.lockedUntil },
    });
    logger.warn(
      { userId: user.id, failedLoginCount: failure.failedLoginCount },
      "login refused: wrong password",
    );
    return { status: "invalid_credentials" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  const session = await createSession(user.id, {
    ipHash: context.ipHash,
    userAgent: context.userAgent,
  });

  logger.info({ userId: user.id, role: user.role }, "login succeeded");

  return { status: "authenticated", user: toSessionUser(user), session };
}

/** Revokes the session the caller is using (§9 "Revocation"). */
export async function endSession(sessionId: string): Promise<void> {
  const revoked = await revokeSession(sessionId);

  if (revoked > 0) {
    logger.info({ sessionId }, "session revoked on sign-out");
  }
}

/** Sign out everywhere: every live session of this account is revoked. */
export async function endAllSessions(userId: string): Promise<number> {
  const { count } = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  logger.info({ userId, sessions: count }, "all sessions revoked");

  return count;
}

/* -------------------------------------------------------------------------- */
/* Email verification and password reset                                      */
/* -------------------------------------------------------------------------- */

export type AuthTokenType = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

export type VerifyEmailOutcome =
  | { status: "verified"; userId: string; email: string }
  | { status: "invalid_token" };

export type TokenInspection = { status: "usable"; expiresAt: Date } | { status: "invalid" };

/**
 * Read-only check used when a link is *opened*: the verify and reset pages ask
 * whether the token can still be used, and render the corresponding panel. It
 * never consumes anything — following a link must not be the thing that spends
 * the token, because a link can be prefetched or scanned by a mail client.
 */
export async function inspectAuthToken(
  rawToken: string,
  type: AuthTokenType,
  now: Date = new Date(),
): Promise<TokenInspection> {
  const token = await db.verificationToken.findUnique({
    where: { tokenHash: hashOpaqueToken(rawToken) },
    select: { type: true, consumedAt: true, expiresAt: true, user: { select: { deletedAt: true } } },
  });

  if (
    !token ||
    token.type !== type ||
    token.consumedAt !== null ||
    token.expiresAt.getTime() <= now.getTime() ||
    token.user.deletedAt !== null
  ) {
    return { status: "invalid" };
  }

  return { status: "usable", expiresAt: token.expiresAt };
}

/**
 * Consumes an email-verification token (§9 registration step 5).
 *
 * Consumption is a compare-and-set (`consumedAt: null` in the `where` clause),
 * so two requests racing on the same link produce exactly one verification; the
 * loser sees the same "invalid" outcome a replay would. Unverified accounts may
 * browse and manage their profile but cannot book or be booked (§9).
 */
export async function verifyEmailAddress(
  rawToken: string,
  now: Date = new Date(),
): Promise<VerifyEmailOutcome> {
  const token = await db.verificationToken.findUnique({
    where: { tokenHash: hashOpaqueToken(rawToken) },
    select: {
      id: true,
      userId: true,
      type: true,
      consumedAt: true,
      expiresAt: true,
      user: { select: { email: true, deletedAt: true } },
    },
  });

  if (
    !token ||
    token.type !== "EMAIL_VERIFICATION" ||
    token.consumedAt !== null ||
    token.expiresAt.getTime() <= now.getTime() ||
    token.user.deletedAt !== null
  ) {
    logger.warn({}, "email verification refused: token unusable");
    return { status: "invalid_token" };
  }

  const consumed = await db.$transaction(async (tx) => {
    const marked = await tx.verificationToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: now },
    });

    if (marked.count !== 1) {
      return false;
    }

    await tx.user.updateMany({
      where: { id: token.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    });

    return true;
  });

  if (!consumed) {
    logger.warn({ userId: token.userId }, "email verification lost a race");
    return { status: "invalid_token" };
  }

  logger.info({ userId: token.userId }, "email address verified");

  return { status: "verified", userId: token.userId, email: token.user.email };
}

/**
 * Sliding renewal at an authenticated mutation boundary (§9). Every Server
 * Action that runs on behalf of a signed-in actor calls this first: renewal
 * writes a cookie, and Next.js forbids that during render, so an action is the
 * only correct place for it. Returns the cookie to write, or null when the
 * session was fresh enough to leave alone.
 */
export function touchSession(session: SessionRecord): Promise<SessionCookieDescriptor | null> {
  return renewSessionIfStale(session);
}


export type RequestResetOutcome = { status: "accepted" };

/**
 * Starts a password reset (§9 "Password reset").
 *
 * The answer is identical whether or not the address exists — always
 * `accepted` — and the response time barely differs either, because the only
 * work an unknown address skips is two indexed writes. Requesting a new link
 * invalidates any earlier unopened one for the same account.
 */
export async function requestPasswordReset(
  input: RequestResetInput,
  context: AuthRequestContext,
): Promise<RequestResetOutcome> {
  const email = normalizeEmail(input.email);

  await enforceRateLimit(
    limiters.passwordResetPerEmail,
    hashOpaqueToken(email),
    "password_reset.per_email",
  );
  await enforceRateLimit(limiters.passwordResetPerIp, context.ipHash, "password_reset.per_ip");

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, deletedAt: true },
  });

  if (!user || user.deletedAt !== null) {
    logger.warn({ ipHash: context.ipHash }, "password reset requested for an unknown address");
    return { status: "accepted" };
  }

  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + verificationTokenPolicy.passwordResetTtlMs);
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.verificationToken.updateMany({
      where: { userId: user.id, type: "PASSWORD_RESET", consumedAt: null },
      data: { consumedAt: now },
    });

    await tx.verificationToken.create({
      data: {
        userId: user.id,
        type: "PASSWORD_RESET",
        tokenHash: hashOpaqueToken(token),
        expiresAt,
      },
    });

    await queueAuthEmail(tx, {
      userId: user.id,
      toEmail: user.email,
      template: "auth.reset-password",
      payload: {
        link: passwordResetLink(token),
        expiresAt: expiresAt.toISOString(),
        fullName: user.fullName,
      },
    });
  });

  logDevelopmentEmail("reset-password", passwordResetLink(token));
  logger.info({ userId: user.id }, "password reset link issued");

  return { status: "accepted" };
}


export type ResetPasswordOutcome = { status: "reset"; email: string } | { status: "invalid_token" };

/**
 * Completes a password reset (§9): the token is consumed, the hash changes, and
 * every live session is revoked — a reset is the strongest signal that an
 * account may have been compromised, so no device stays signed in — while the
 * lockout counters are cleared so the owner can get straight back in.
 */
export async function resetPassword(
  input: ResetPasswordInput,
  now: Date = new Date(),
): Promise<ResetPasswordOutcome> {
  const token = await db.verificationToken.findUnique({
    where: { tokenHash: hashOpaqueToken(input.token) },
    select: {
      id: true,
      userId: true,
      type: true,
      consumedAt: true,
      expiresAt: true,
      user: { select: { email: true, fullName: true, deletedAt: true } },
    },
  });

  if (
    !token ||
    token.type !== "PASSWORD_RESET" ||
    token.consumedAt !== null ||
    token.expiresAt.getTime() <= now.getTime() ||
    token.user.deletedAt !== null
  ) {
    logger.warn({}, "password reset refused: token unusable");
    return { status: "invalid_token" };
  }

  const passwordHash = await hashPassword(input.password);

  const completed = await db.$transaction(async (tx) => {
    const marked = await tx.verificationToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: now },
    });

    if (marked.count !== 1) {
      return false;
    }

    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });

    await tx.session.updateMany({
      where: { userId: token.userId, revokedAt: null },
      data: { revokedAt: now },
    });

    await queueAuthEmail(tx, {
      userId: token.userId,
      toEmail: token.user.email,
      template: "auth.password-changed",
      payload: { fullName: token.user.fullName, changedAt: now.toISOString() },
    });

    return true;
  });

  if (!completed) {
    logger.warn({ userId: token.userId }, "password reset lost a race");
    return { status: "invalid_token" };
  }

  logger.info({ userId: token.userId }, "password reset completed");

  return { status: "reset", email: token.user.email };
}

export type ResendVerificationOutcome = { status: "sent" } | { status: "already_verified" };

/**
 * Issues a fresh verification link (§9). Idempotent for an address that is
 * already verified: the caller is told "already verified" rather than being
 * sent mail they do not need.
 */
export async function resendEmailVerification(userId: string): Promise<ResendVerificationOutcome> {
  await enforceRateLimit(limiters.resendVerificationPerUser, userId, "resend_verification.per_user");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, emailVerifiedAt: true, deletedAt: true },
  });

  if (!user || user.deletedAt !== null || user.emailVerifiedAt !== null) {
    return { status: "already_verified" };
  }

  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + verificationTokenPolicy.emailVerificationTtlMs);
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.verificationToken.updateMany({
      where: { userId: user.id, type: "EMAIL_VERIFICATION", consumedAt: null },
      data: { consumedAt: now },
    });

    await tx.verificationToken.create({
      data: {
        userId: user.id,
        type: "EMAIL_VERIFICATION",
        tokenHash: hashOpaqueToken(token),
        expiresAt,
      },
    });

    await queueAuthEmail(tx, {
      userId: user.id,
      toEmail: user.email,
      template: "auth.verify-email",
      payload: {
        link: verificationLink(token),
        expiresAt: expiresAt.toISOString(),
        fullName: user.fullName,
      },
    });
  });

  logDevelopmentEmail("verify-email", verificationLink(token));
  logger.info({ userId: user.id }, "verification link reissued");

  return { status: "sent" };
}

