/**
 * Pinned logger redaction paths and privacy sanitization (ARCHITECTURE.md §16, §17).
 * Prevents clinical content, credentials, tokens, and PII from appearing in log streams.
 */

export const REDACTED_PATHS = [
  "password",
  "*.password",
  "*.*.password",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
  "tokenHash",
  "*.tokenHash",
  "clientNote",
  "*.clientNote",
  "noteBody",
  "*.noteBody",
  "body",
  "*.body",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "creditCard",
  "*.creditCard",
  "phone",
  "*.phone",
  "emergencyContactPhone",
  "*.emergencyContactPhone",
  "emergencyContactName",
  "*.emergencyContactName",
  "secret",
  "*.secret",
  "apiKey",
  "*.apiKey",
  "CRON_SECRET",
  "NOTES_ENCRYPTION_KEY",
] as const;

export const CENSOR_VALUE = "[REDACTED]";

/**
 * Strips or redacts sensitive keys from an arbitrary object before logging or reporting.
 */
export function sanitizeLogPayload<T>(payload: T): T {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeLogPayload(item)) as unknown as T;
  }

  const sensitiveKeys = new Set([
    "password",
    "passwordhash",
    "token",
    "tokenhash",
    "clientnote",
    "notebody",
    "body",
    "authorization",
    "cookie",
    "phone",
    "emergencycontactphone",
    "emergencycontactname",
    "secret",
    "apikey",
  ]);

  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = CENSOR_VALUE;
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizeLogPayload(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized as T;
}
