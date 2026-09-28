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

export function createRateLimiter(budget: RateLimitBudget): RateLimiter {
  return new MemoryRateLimiter(budget);
}
