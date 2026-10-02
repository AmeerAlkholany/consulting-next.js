import { describe, expect, it } from "vitest";
import { loginLockoutPolicy, sessionPolicy } from "@/config/security";
import {
  buildSessionCookie,
  evaluateLockout,
  isLocalhostOrigin,
  isSessionExpired,
  registerFailedLogin,
  sessionExpiry,
  shouldRenewSession,
  shouldUseSecureCookie,
} from "@/lib/auth-policy";

/**
 * Session and lockout arithmetic (IMPLEMENTATION.md Step 4, "Testing
 * requirements": session expiry arithmetic, lockout arithmetic). These are
 * pure functions, which is why the rules can be asserted to the millisecond
 * rather than inferred from an integration test.
 */

const NOW = new Date("2026-03-01T10:00:00.000Z");

describe("session expiry arithmetic", () => {
  it("places the absolute expiry the configured number of days ahead", () => {
    expect(sessionExpiry(NOW, 7).toISOString()).toBe("2026-03-08T10:00:00.000Z");
  });

  it("follows the configured TTL rather than a hard-coded week", () => {
    expect(sessionExpiry(NOW, 1).toISOString()).toBe("2026-03-02T10:00:00.000Z");
  });

  it("treats an expiry exactly at the current instant as expired", () => {
    expect(isSessionExpired(NOW, NOW)).toBe(true);
    expect(isSessionExpired(new Date(NOW.getTime() + 1), NOW)).toBe(false);
  });

  it("does not renew a session younger than the idle threshold", () => {
    const usedMomentsAgo = new Date(NOW.getTime() - 60 * 1000);
    expect(shouldRenewSession(usedMomentsAgo, NOW)).toBe(false);
  });

  it("renews a session idle for longer than the threshold", () => {
    const usedLongAgo = new Date(NOW.getTime() - sessionPolicy.renewalThresholdMs);
    expect(shouldRenewSession(usedLongAgo, NOW)).toBe(true);
  });
});

describe("session cookie attributes", () => {
  const expiresAt = sessionExpiry(NOW, 7);

  it("is httpOnly, lax, rooted at /, and expires with the row", () => {
    const cookie = buildSessionCookie({
      name: "session",
      token: "opaque-token",
      expiresAt,
      secure: true,
    });

    expect(cookie).toEqual({
      name: "session",
      value: "opaque-token",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
      },
    });
  });

  it("is always secure in production", () => {
    expect(shouldUseSecureCookie({ nodeEnv: "production", appUrl: "http://localhost:3000" })).toBe(
      true,
    );
  });

  it("may be insecure only for a plain-http local development origin", () => {
    expect(shouldUseSecureCookie({ nodeEnv: "development", appUrl: "http://localhost:3000" })).toBe(
      false,
    );
    expect(
      shouldUseSecureCookie({ nodeEnv: "development", appUrl: "https://staging.example.com" }),
    ).toBe(true);
  });

  it("recognises localhost spellings", () => {
    expect(isLocalhostOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalhostOrigin("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalhostOrigin("not a url")).toBe(false);
    expect(isLocalhostOrigin("https://example.com")).toBe(false);
  });
});

describe("login lockout arithmetic", () => {
  it("does not lock before the tenth consecutive failure", () => {
    let state: { failedLoginCount: number; lockedUntil: Date | null } = {
      failedLoginCount: 0,
      lockedUntil: null,
    };

    for (let attempt = 1; attempt < loginLockoutPolicy.maxFailedAttempts; attempt += 1) {
      state = registerFailedLogin(state, NOW);
      expect(state.lockedUntil).toBeNull();
      expect(state.failedLoginCount).toBe(attempt);
    }
  });

  it("locks for fifteen minutes on the tenth failure", () => {
    const state = registerFailedLogin(
      { failedLoginCount: loginLockoutPolicy.maxFailedAttempts - 1, lockedUntil: null },
      NOW,
    );

    expect(state.failedLoginCount).toBe(10);
    expect(state.lockedUntil?.toISOString()).toBe(
      new Date(NOW.getTime() + loginLockoutPolicy.lockDurationMs).toISOString(),
    );
  });

  it("reports the remaining wait while the lock holds", () => {
    const lockedUntil = new Date(NOW.getTime() + 15 * 60 * 1000);
    const state = evaluateLockout({ failedLoginCount: 10, lockedUntil }, NOW);

    expect(state.isLocked).toBe(true);
    expect(state.remainingMs).toBe(15 * 60 * 1000);
  });

  it("treats an elapsed lock as a fresh window rather than an instant re-lock", () => {
    const expired = new Date(NOW.getTime() - 1000);
    const state = evaluateLockout({ failedLoginCount: 10, lockedUntil: expired }, NOW);

    expect(state.isLocked).toBe(false);
    expect(state.failedLoginCount).toBe(0);

    const next = registerFailedLogin({ failedLoginCount: 10, lockedUntil: expired }, NOW);
    expect(next.failedLoginCount).toBe(1);
    expect(next.lockedUntil).toBeNull();
  });
});
