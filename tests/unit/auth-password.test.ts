import { describe, expect, it } from "vitest";
import { argon2idParameters } from "@/config/security";
import {
  dummyPasswordHash,
  hashPassword,
  runDummyPasswordComparison,
  verifyPassword,
} from "@/server/auth/password";

/**
 * Password hashing (IMPLEMENTATION.md Step 4, "Testing requirements": password
 * hash and verify round-trip). The parameter set is asserted from the encoded
 * hash itself, so a change to `config/security.ts` that is not reflected in
 * stored hashes fails here.
 */

const PASSWORD = "Correct-Horse-42";

describe("hashPassword", () => {
  it("produces an Argon2id PHC string with the pinned parameters", async () => {
    const encoded = await hashPassword(PASSWORD);

    expect(encoded).toMatch(/^\$argon2id\$v=19\$/);
    expect(encoded).toContain(`m=${argon2idParameters.memoryCostKiB}`);
    expect(encoded).toContain(`t=${argon2idParameters.timeCost}`);
    expect(encoded).toContain(`p=${argon2idParameters.parallelism}`);
    expect(encoded.length).toBeLessThanOrEqual(255);
  });

  it("salts every hash, so the same password never hashes twice", async () => {
    const [first, second] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)]);

    expect(first).not.toBe(second);
  });
});

describe("verifyPassword", () => {
  it("round-trips the correct password", async () => {
    const encoded = await hashPassword(PASSWORD);

    await expect(verifyPassword(encoded, PASSWORD)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const encoded = await hashPassword(PASSWORD);

    await expect(verifyPassword(encoded, "Correct-Horse-43")).resolves.toBe(false);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    await expect(verifyPassword("not-a-phc-string", PASSWORD)).resolves.toBe(false);
    await expect(verifyPassword("", PASSWORD)).resolves.toBe(false);
  });
});

describe("constant-work login path", () => {
  it("keeps one throwaway hash per process", async () => {
    const [first, second] = await Promise.all([dummyPasswordHash(), dummyPasswordHash()]);

    expect(first).toBe(second);
  });

  it("does nothing observable when compared against", async () => {
    // The assertion that matters is that this resolves rather than throws or
    // leaks: `loginUser` calls it instead of verifying a real hash when the
    // account does not exist.
    await expect(runDummyPasswordComparison("anything")).resolves.toBeUndefined();
  });
});
