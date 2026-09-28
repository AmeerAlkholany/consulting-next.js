/**
 * Validated environment variables parsed once at module import.
 *
 * In Step 1, this parser validates process.env by hand to throw descriptive errors
 * naming all missing variables at once without leaking secret values.
 * Step 2 converts this to a Zod schema once Zod is added to dependencies.
 *
 * All code across the repository MUST read environment variables from this module
 * rather than process.env directly.
 */

export interface Env {
  NODE_ENV: "development" | "production" | "test";
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  APP_URL: string;
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_DAYS: number;
  CRON_SECRET?: string;
  NOTES_ENCRYPTION_KEY?: string;
  NOTES_ENCRYPTION_KEY_ID: string;
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?: string;
  RATE_LIMIT_DRIVER: "memory" | "redis";
  REDIS_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  EMAIL_PROVIDER: "none" | "resend" | "ses" | "smtp";
  EMAIL_API_KEY?: string;
  EMAIL_FROM: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SEED_ADMIN_EMAIL?: string;
  SEED_ADMIN_PASSWORD?: string;
  LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  SENTRY_DSN?: string;
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_SUPPORT_EMAIL: string;
}

function parseEnv(): Env {
  const nodeEnv = (process.env.NODE_ENV ?? "development") as Env["NODE_ENV"];
  const isProd = nodeEnv === "production";
  const errors: string[] = [];

  function readString(key: string, required: boolean, fallback?: string): string {
    const val = process.env[key];
    if (!val || val.trim() === "") {
      if (fallback !== undefined) {
        return fallback;
      }
      if (required) {
        errors.push(`Missing required environment variable: ${key}`);
      }
      return "";
    }
    return val.trim();
  }

  function readNumber(key: string, fallback: number): number {
    const val = process.env[key];
    if (!val || val.trim() === "") {
      return fallback;
    }
    const num = Number(val);
    if (Number.isNaN(num)) {
      errors.push(`Invalid number for environment variable ${key}: "${val}"`);
      return fallback;
    }
    return num;
  }

  const appUrl = readString("APP_URL", isProd, "http://localhost:3000");
  if (appUrl) {
    try {
      new URL(appUrl);
    } catch {
      errors.push(`Invalid URL format for APP_URL: "${appUrl}"`);
    }
  }

  const rateLimitDriver = readString(
    "RATE_LIMIT_DRIVER",
    false,
    "memory",
  ) as Env["RATE_LIMIT_DRIVER"];
  if (rateLimitDriver !== "memory" && rateLimitDriver !== "redis") {
    errors.push(`RATE_LIMIT_DRIVER must be 'memory' or 'redis', received '${rateLimitDriver}'`);
  }

  const emailProvider = readString("EMAIL_PROVIDER", false, "none") as Env["EMAIL_PROVIDER"];
  if (!["none", "resend", "ses", "smtp"].includes(emailProvider)) {
    errors.push(
      `EMAIL_PROVIDER must be 'none', 'resend', 'ses', or 'smtp', received '${emailProvider}'`,
    );
  }

  const logLevel = readString("LOG_LEVEL", false, "info") as Env["LOG_LEVEL"];
  if (!["fatal", "error", "warn", "info", "debug", "trace"].includes(logLevel)) {
    errors.push(
      `LOG_LEVEL must be one of fatal, error, warn, info, debug, trace; received '${logLevel}'`,
    );
  }

  if (isProd && rateLimitDriver === "memory") {
    // ADR-014: In-memory rate limiting across multiple production instances gives a false sense of safety
    console.warn("WARNING: RATE_LIMIT_DRIVER is set to 'memory' in production mode.");
  }

  if (errors.length > 0) {
    throw new Error(
      `\n❌ Invalid environment configuration:\n${errors.map((err) => `  - ${err}`).join("\n")}\n`,
    );
  }

  const envObject: Env = {
    NODE_ENV: nodeEnv,
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    DIRECT_URL: process.env.DIRECT_URL || undefined,
    APP_URL: appUrl,
    SESSION_COOKIE_NAME: readString("SESSION_COOKIE_NAME", false, "session"),
    SESSION_TTL_DAYS: readNumber("SESSION_TTL_DAYS", 7),
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    NOTES_ENCRYPTION_KEY: process.env.NOTES_ENCRYPTION_KEY || undefined,
    NOTES_ENCRYPTION_KEY_ID: readString("NOTES_ENCRYPTION_KEY_ID", false, "k1"),
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY || undefined,
    RATE_LIMIT_DRIVER: rateLimitDriver,
    REDIS_URL: process.env.REDIS_URL || undefined,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || undefined,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
    EMAIL_PROVIDER: emailProvider,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY || undefined,
    EMAIL_FROM: readString("EMAIL_FROM", false, "noreply@example.com"),
    SMTP_HOST: process.env.SMTP_HOST || undefined,
    SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    SMTP_USER: process.env.SMTP_USER || undefined,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD || undefined,
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || undefined,
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || undefined,
    LOG_LEVEL: logLevel,
    SENTRY_DSN: process.env.SENTRY_DSN || undefined,
    NEXT_PUBLIC_APP_NAME: readString("NEXT_PUBLIC_APP_NAME", false, "Consulting Platform"),
    NEXT_PUBLIC_SUPPORT_EMAIL: readString(
      "NEXT_PUBLIC_SUPPORT_EMAIL",
      false,
      "support@example.com",
    ),
  };

  return Object.freeze(envObject);
}

export const env = parseEnv();
