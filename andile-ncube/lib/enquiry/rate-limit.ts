import "server-only";

/**
 * Best-effort, per-instance rate limit. It stops a single client hammering one
 * server process; it does not coordinate across serverless instances. For a
 * hard limit, put the endpoint behind your platform's firewall rules or swap
 * this for a shared store such as Upstash Redis.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;
const hits = new Map<string, number[]>();

export function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > MAX_HITS;
}
