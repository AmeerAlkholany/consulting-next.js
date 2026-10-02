import { describe, expect, it } from "vitest";
import { sessionPolicy } from "@/config/security";
import {
  constantTimeEquals,
  generateOpaqueToken,
  hashIpAddress,
  hashOpaqueToken,
} from "@/server/auth/tokens";

/**
 * Token generation and hashing (IMPLEMENTATION.md Step 4, "Testing
 * requirements"). The properties asserted here are the ones the security model
 * depends on: tokens are unguessable, only hashes are stored, and the stored
 * form is exactly the width of the `Char(64)` column it goes into.
 */

describe("generateOpaqueToken", () => {
  it("produces 32 random bytes as 43 base64url characters", () => {
    const token = generateOpaqueToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(sessionPolicy.tokenBytes);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateOpaqueToken()));

    expect(tokens.size).toBe(200);
  });

  it("accepts a different length when asked", () => {
    expect(Buffer.from(generateOpaqueToken(16), "base64url")).toHaveLength(16);
  });
});

describe("hashOpaqueToken", () => {
  it("is a lowercase SHA-256 hex digest that fits Char(64)", () => {
    const digest = hashOpaqueToken("some-token");

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable for the same input and different for a different one", () => {
    expect(hashOpaqueToken("a")).toBe(hashOpaqueToken("a"));
    expect(hashOpaqueToken("a")).not.toBe(hashOpaqueToken("b"));
  });

  it("is not the token itself, nor its prefix", () => {
    const token = generateOpaqueToken();
    const digest = hashOpaqueToken(token);

    expect(digest).not.toContain(token);
    expect(digest).not.toContain(token.slice(0, 8));
  });
});

describe("constantTimeEquals", () => {
  it("accepts equal digests and rejects unequal ones", () => {
    const digest = hashOpaqueToken("token");

    expect(constantTimeEquals(digest, digest)).toBe(true);
    expect(constantTimeEquals(digest, hashOpaqueToken("other"))).toBe(false);
  });

  it("rejects different-length inputs instead of throwing", () => {
    expect(constantTimeEquals("abc", "abcd")).toBe(false);
  });
});

describe("hashIpAddress", () => {
  it("pseudonymises the address into a 64-character digest", () => {
    const digest = hashIpAddress("203.0.113.7");

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain("203.0.113.7");
  });

  it("normalises spacing and case so one client maps to one key", () => {
    expect(hashIpAddress(" 203.0.113.7 ")).toBe(hashIpAddress("203.0.113.7"));
  });
});
