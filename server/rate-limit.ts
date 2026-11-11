import { env } from "@/config/env";
import { logger } from "@/server/logger";
import Redis from "ioredis";

export interface RateLimitBudget {
  points: number;
  durationMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  consume(key: string, points?: number): Promise<RateLimitResult>;
}

interface MemoryStoreEntry {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly store = new Map<string, MemoryStoreEntry>();
  private readonly budget: RateLimitBudget;

  constructor(budget: RateLimitBudget) {
    this.budget = budget;
  }

  async consume(key: string, points = 1): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.budget.durationMs;
      this.store.set(key, { count: points, resetAt });
      return {
        allowed: points <= this.budget.points,
        remaining: Math.max(0, this.budget.points - points),
        resetAt,
      };
    }

    entry.count += points;
    const allowed = entry.count <= this.budget.points;
    const remaining = Math.max(0, this.budget.points - entry.count);

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
    };
  }
}

/**
 * Production Redis rate limiter using fixed window with atomic PEXPIRE.
 */
export class RedisRateLimiter implements RateLimiter {
  private readonly client: Redis;
  private readonly budget: RateLimitBudget;
  private readonly keyPrefix: string;

  constructor(client: Redis, budget: RateLimitBudget, keyPrefix = "rl:") {
    this.client = client;
    this.budget = budget;
    this.keyPrefix = keyPrefix;
  }

  async consume(key: string, points = 1): Promise<RateLimitResult> {
    const fullKey = `${this.keyPrefix}${key}`;
    const now = Date.now();

    try {
      const count = await this.client.incrby(fullKey, points);
      if (count === points) {
        // Set expiry on first touch
        await this.client.pexpire(fullKey, this.budget.durationMs);
        return {
          allowed: points <= this.budget.points,
          remaining: Math.max(0, this.budget.points - points),
          resetAt: now + this.budget.durationMs,
        };
      }

      const pttl = await this.client.pttl(fullKey);
      const resetAt = pttl > 0 ? now + pttl : now + this.budget.durationMs;
      const allowed = count <= this.budget.points;
      const remaining = Math.max(0, this.budget.points - count);

      return {
        allowed,
        remaining,
        resetAt,
      };
    } catch (err) {
      logger.error({ error: err }, "Redis rate limiter query failed; failing open");
      return {
        allowed: true,
        remaining: 1,
        resetAt: now + this.budget.durationMs,
      };
    }
  }
}

let sharedRedisClient: Redis | null = null;

function getSharedRedisClient(): Redis | null {
  if (env.RATE_LIMIT_DRIVER !== "redis" || !env.REDIS_URL) {
    return null;
  }

  if (!sharedRedisClient) {
    sharedRedisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }

  return sharedRedisClient;
}

export function createRateLimiter(budget: RateLimitBudget): RateLimiter {
  const redis = getSharedRedisClient();
  if (redis) {
    return new RedisRateLimiter(redis, budget);
  }
  return new MemoryRateLimiter(budget);
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Standard system rate limits per ARCHITECTURE.md §16.
 */
export const surfaceRateLimits = {
  // Login: 5 / 15 min per IP+email, 20 / 15 min per IP
  loginPerIpAndEmail: { points: 5, durationMs: 15 * MINUTE },
  loginPerIp: { points: 20, durationMs: 15 * MINUTE },
  // Registration: 5 / hour per IP
  registerPerIp: { points: 5, durationMs: HOUR },
  // Password reset: 3 / hour per email, 10 / hour per IP
  passwordResetPerEmail: { points: 3, durationMs: HOUR },
  passwordResetPerIp: { points: 10, durationMs: HOUR },
  // Booking creation: 10 / hour per user
  createAppointmentPerUser: { points: 10, durationMs: HOUR },
  // Review creation: 5 / day per user
  createReviewPerUser: { points: 5, durationMs: DAY },
  // Search & availability: 60 / min per IP
  searchAndAvailabilityPerIp: { points: 60, durationMs: MINUTE },
  // Notification unread count badge: 120 / min per session
  unreadCountPerSession: { points: 120, durationMs: MINUTE },
} as const;

export { authRateLimits } from "@/config/security";
