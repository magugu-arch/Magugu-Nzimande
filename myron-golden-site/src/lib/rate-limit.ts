/**
 * A fixed-window limiter held in memory. It stops casual abuse of the forms
 * on a single server instance; across several instances or serverless
 * invocations it is per-instance only, so production should back it with a
 * shared store (Upstash/Redis or the host's own limiter). See README.
 */
export interface RateLimiter {
  /** True if the call is allowed. */
  check(key: string, now?: number): boolean;
}

export function createRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const { limit, windowMs } = options;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key, now = Date.now()) {
      // Opportunistic sweep so the map cannot grow without bound.
      if (buckets.size > 5000) {
        for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      }
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    },
  };
}
