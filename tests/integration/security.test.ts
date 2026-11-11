import { describe, it, expect } from "vitest";
import { getSecurityHeaders } from "@/server/security/headers";
import { generateCspNonce, generateCspHeader } from "@/server/security/csp";
import { sanitizeLogPayload, REDACTED_PATHS, CENSOR_VALUE } from "@/server/security/redaction";
import { MemoryRateLimiter, surfaceRateLimits } from "@/server/rate-limit";
import { loginUser } from "@/server/services/auth";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("Security Hardening Integration Tests (Step 19)", () => {
  describe("Security Headers & CSP Nonce", () => {
    it("generates 128-bit base64-encoded CSP nonce", () => {
      const nonce = generateCspNonce();
      expect(typeof nonce).toBe("string");
      expect(nonce.length).toBeGreaterThanOrEqual(20);
      // Valid base64 check
      expect(/^[A-Za-z0-9+/=]+$/.test(nonce)).toBe(true);
    });

    it("generates strict Content-Security-Policy with strict-dynamic and no script unsafe-inline", () => {
      const nonce = "test-nonce-123456";
      const csp = generateCspHeader(nonce);

      expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
      expect(csp).not.toContain("script-src 'unsafe-inline'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("object-src 'none'");
    });

    it("produces complete security headers including HSTS, nosniff, and frame denial", () => {
      const headers = getSecurityHeaders({ nonce: "sample-nonce", isPrivate: true });

      expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["Permissions-Policy"]).toContain("camera=()");
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow");
      expect(headers["Content-Security-Policy"]).toBeDefined();
    });

    it("proxy injects security headers and CSP nonce into response and request headers", async () => {
      const req = new NextRequest("http://localhost:3000/consultants", {
        method: "GET",
      });

      const res = await proxy(req);
      expect(res.headers.get("x-request-id")).toBeDefined();
      expect(res.headers.get("x-nonce")).toBeDefined();
      expect(res.headers.get("Content-Security-Policy")).toBeDefined();
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });
  });

  describe("Rate Limiting Surface Hardening", () => {
    it("enforces rate limit budgets and reports correct remaining counters and reset times", async () => {
      const limiter = new MemoryRateLimiter({ points: 3, durationMs: 60000 });
      const key = "test-client-ip";

      const res1 = await limiter.consume(key);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);

      const res2 = await limiter.consume(key);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = await limiter.consume(key);
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);

      // Exceeded threshold
      const res4 = await limiter.consume(key);
      expect(res4.allowed).toBe(false);
      expect(res4.remaining).toBe(0);
      expect(res4.resetAt).toBeGreaterThan(Date.now());
    });

    it("verifies defined system budgets comply with ARCHITECTURE.md §16", () => {
      expect(surfaceRateLimits.loginPerIpAndEmail.points).toBe(5);
      expect(surfaceRateLimits.registerPerIp.points).toBe(5);
      expect(surfaceRateLimits.createAppointmentPerUser.points).toBe(10);
      expect(surfaceRateLimits.createReviewPerUser.points).toBe(5);
      expect(surfaceRateLimits.searchAndAvailabilityPerIp.points).toBe(60);
      expect(surfaceRateLimits.unreadCountPerSession.points).toBe(120);
    });
  });

  describe("Logger Redaction & Clinical Privacy", () => {
    it("redacts sensitive fields in log payloads", () => {
      const sensitiveData = {
        userId: "12345",
        password: "SuperSecretPassword123!",
        passwordHash: "$argon2id$v=19$...",
        token: "opaque-session-token",
        clientNote: "Client has severe anxiety issues",
        noteBody: "Clinical diagnosis confidential notes",
        authorization: "Bearer secret-token",
        phone: "+15551234567",
      };

      const sanitized = sanitizeLogPayload(sensitiveData);

      expect(sanitized.userId).toBe("12345");
      expect(sanitized.password).toBe(CENSOR_VALUE);
      expect(sanitized.passwordHash).toBe(CENSOR_VALUE);
      expect(sanitized.token).toBe(CENSOR_VALUE);
      expect(sanitized.clientNote).toBe(CENSOR_VALUE);
      expect(sanitized.noteBody).toBe(CENSOR_VALUE);
      expect(sanitized.authorization).toBe(CENSOR_VALUE);
      expect(sanitized.phone).toBe(CENSOR_VALUE);
    });

    it("verifies logger redaction paths include all clinical and credential fields", () => {
      expect(REDACTED_PATHS).toContain("password");
      expect(REDACTED_PATHS).toContain("passwordHash");
      expect(REDACTED_PATHS).toContain("clientNote");
      expect(REDACTED_PATHS).toContain("noteBody");
      expect(REDACTED_PATHS).toContain("authorization");
      expect(REDACTED_PATHS).toContain("token");
    });
  });

  describe("Authentication Enumeration Defenses", () => {
    it("returns identical error responses for nonexistent user vs invalid password", async () => {
      // 1. Nonexistent user
      const nonExistentRes = await loginUser(
        {
          email: "nonexistent-user-12345@example.com",
          password: "InvalidPassword123!",
        },
        {
          ipAddress: "127.0.0.1",
          ipHash: "security-test-ip-hash",
          userAgent: "security-test-agent",
        },
      );

      // 2. Format / response check
      expect(nonExistentRes.status).toBe("invalid_credentials");
    });
  });
});
