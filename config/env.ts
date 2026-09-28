import { z } from "zod";

/**
 * Validated environment variables parsed once at module import.
 *
 * In Step 2, this is backed by Zod schemas per ARCHITECTURE.md §27.
 * All code across the repository MUST read environment variables from this module
 * rather than process.env directly.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_COOKIE_NAME: z.string().default("session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CRON_SECRET: z.string().min(1).optional(),
  NOTES_ENCRYPTION_KEY: z.string().min(1).optional(),
  NOTES_ENCRYPTION_KEY_ID: z.string().default("k1"),
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(1).optional(),
  RATE_LIMIT_DRIVER: z.enum(["memory", "redis"]).default("memory"),
  REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  EMAIL_PROVIDER: z.enum(["none", "resend", "ses", "smtp"]).default("none"),
  EMAIL_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().default("noreply@example.com"),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("Consulting Platform"),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().default("support@example.com"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("\n");
    throw new Error(`\n❌ Invalid environment configuration:\n${errorDetails}\n`);
  }

  const parsed = result.data;

  if (parsed.NODE_ENV === "production" && parsed.RATE_LIMIT_DRIVER === "memory") {
    // ADR-014: In-memory rate limiting across multiple production instances gives a false sense of safety
    console.warn("WARNING: RATE_LIMIT_DRIVER is set to 'memory' in production mode.");
  }

  return Object.freeze(parsed);
}

export const env = parseEnv();
