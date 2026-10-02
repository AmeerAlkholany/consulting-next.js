import "server-only";

import { randomUUID } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify, type Options } from "@node-rs/argon2";
import { argon2idParameters } from "@/config/security";

/**
 * Password hashing (ARCHITECTURE.md §9 registration step 3, §16).
 *
 * Argon2id with the parameters pinned in `config/security.ts`. The library
 * encodes its own salt into the returned string (16 bytes, generated per call),
 * so a stored `passwordHash` is self-describing: verification re-reads the
 * cost parameters from the hash itself, which is what makes a future parameter
 * change a re-hash-on-next-login rather than a breaking migration.
 */

/**
 * `Algorithm.Argon2id`. Written as its numeric value because the package
 * declares `Algorithm` as an ambient `const enum`, which `isolatedModules`
 * (and therefore Next.js) forbids referencing. `satisfies Options` below keeps
 * the value honest.
 */
const ARGON2ID = 2;

const ARGON2ID_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: argon2idParameters.memoryCostKiB,
  timeCost: argon2idParameters.timeCost,
  parallelism: argon2idParameters.parallelism,
  outputLen: argon2idParameters.outputLengthBytes,
} satisfies Options;

/** Returns the PHC-encoded Argon2id string stored in `User.passwordHash`. */
export function hashPassword(plainPassword: string): Promise<string> {
  return argon2Hash(plainPassword, ARGON2ID_OPTIONS);
}

/**
 * Returns false for a wrong password *and* for a hash that cannot be parsed, so
 * a corrupted row is a failed sign-in rather than a 500 that tells an attacker
 * they found something.
 */
export async function verifyPassword(encodedHash: string, plainPassword: string): Promise<boolean> {
  try {
    return await argon2Verify(encodedHash, plainPassword, ARGON2ID_OPTIONS);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * A hash of a random string, computed once per process, used to make the
 * "unknown email" path cost the same as the "wrong password" path
 * (ARCHITECTURE.md §9 login step 2). Without it, a missing account answers
 * markedly faster and the response time itself enumerates accounts.
 */
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(`unused-${randomUUID()}`);
  return dummyHash;
}

/**
 * Performs exactly one verification against a throwaway hash and discards the
 * result: the constant-work half of a failed sign-in.
 */
export async function runDummyPasswordComparison(candidatePassword: string): Promise<void> {
  const hash = await dummyPasswordHash();
  await verifyPassword(hash, candidatePassword);
}
