import "server-only";

import crypto from "node:crypto";
import { env } from "@/config/env";
import { logger } from "@/server/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  tag: string; // Base64 encoded
  keyId: string;
}

/**
 * Packs the encrypted components into a single serializable envelope string:
 * `enc:v1:<keyId>:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 */
export function packEncryptedEnvelope(payload: EncryptedPayload): string {
  return `enc:v1:${payload.keyId}:${payload.iv}:${payload.tag}:${payload.ciphertext}`;
}

/**
 * Unpacks an encrypted envelope string into its components.
 */
export function unpackEncryptedEnvelope(envelope: string): EncryptedPayload {
  const parts = envelope.split(":");
  if (parts.length !== 6 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Invalid encryption envelope format");
  }
  return {
    keyId: parts[2]!,
    iv: parts[3]!,
    tag: parts[4]!,
    ciphertext: parts[5]!,
  };
}

/**
 * Retrieves the encryption key buffer for the given key id.
 * Supports current active key from env or throws.
 */
function getKey(keyId: string): Buffer {
  const activeKeyId = env.NOTES_ENCRYPTION_KEY_ID || "k1";
  if (keyId !== activeKeyId) {
    logger.error({ requestedKeyId: keyId, activeKeyId }, "Requested encryption keyId is unknown or rotated out");
    throw new Error(`Unknown encryption key id: ${keyId}`);
  }

  const base64Key = env.NOTES_ENCRYPTION_KEY;
  if (!base64Key) {
    throw new Error("NOTES_ENCRYPTION_KEY environment variable is not configured");
  }

  const keyBuffer = Buffer.from(base64Key, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(`Invalid NOTES_ENCRYPTION_KEY length: expected 32 bytes, got ${keyBuffer.length}`);
  }

  return keyBuffer;
}

/**
 * Encrypts a plaintext UTF-8 string with AES-256-GCM.
 * Uses a unique 12-byte random IV per call.
 */
export function encryptText(plaintext: string): string {
  const activeKeyId = env.NOTES_ENCRYPTION_KEY_ID || "k1";
  const key = getKey(activeKeyId);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return packEncryptedEnvelope({
    keyId: activeKeyId,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

/**
 * Decrypts an encrypted envelope string with AES-256-GCM.
 * Returns null if decryption or authentication tag verification fails.
 */
export function decryptText(envelope: string): string | null {
  try {
    const payload = unpackEncryptedEnvelope(envelope);
    const key = getKey(payload.keyId);
    const iv = Buffer.from(payload.iv, "base64");
    const tag = Buffer.from(payload.tag, "base64");
    const ciphertext = Buffer.from(payload.ciphertext, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    logger.error({ error }, "Failed to decrypt note envelope");
    return null;
  }
}
