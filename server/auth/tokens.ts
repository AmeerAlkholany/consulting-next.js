import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sessionPolicy, verificationTokenPolicy } from "@/config/security";

/**
 * Opaque token material (ARCHITECTURE.md §9 "Session mechanics", "Password
 * reset").
 *
 * Two rules hold everywhere in this module: tokens are generated from
 * `randomBytes` (never from a seeded or time-based source), and only their
 * SHA-256 hash is ever stored. A database dump therefore contains no usable
 * session or reset credential, and `Session.tokenHash` / `VerificationToken.tokenHash`
 * (`Char(64)`) hold exactly what `hashOpaqueToken` returns.
 */

/** 32 cryptographically random bytes, base64url-encoded (43 characters). */
export function generateOpaqueToken(byteLength: number = sessionPolicy.tokenBytes): string {
  return randomBytes(byteLength).toString("base64url");
}

/** Lowercase hex SHA-256, 64 characters — the stored form of every token. */
export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time equality for two hex digests. Lookups go through the unique
 * index on `tokenHash`, so this is used only where a comparison happens in
 * application code and timing must not leak length or prefix agreement.
 */
export function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Pseudonymised client address, for `Session.ipHash` and for rate-limit keys
 * (§16, §17: an address is never stored or logged in the clear). SHA-256 over
 * the address is pseudonymisation, not encryption: it is deliberately
 * uncorrelatable across sites, and it is not treated as anonymous data.
 */
export function hashIpAddress(ipAddress: string): string {
  return createHash("sha256").update(ipAddress.trim().toLowerCase(), "utf8").digest("hex");
}

export const tokenTtls = {
  emailVerificationMs: verificationTokenPolicy.emailVerificationTtlMs,
  passwordResetMs: verificationTokenPolicy.passwordResetTtlMs,
} as const;
