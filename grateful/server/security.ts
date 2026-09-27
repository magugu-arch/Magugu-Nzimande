/**
 * Guards for the public endpoints.
 *
 * Rate limiting is a fixed window per IP per bucket, held in memory. On a
 * serverless host each warm instance keeps its own counts, so treat this as a
 * speed bump against scripts, not a wall; put the host's WAF or a shared
 * store (e.g. Upstash) in front for anything stronger.
 */

const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(bucket: string, ip: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const key = `${bucket}:${ip}`;
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    }
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

export function resetRateLimits() {
  windows.clear();
}

/**
 * Honeypot + timing. `company` is a field hidden from people; `elapsedMs` is
 * how long the form was open. A human cannot fill a form in under 1.5 s.
 * Returns true when the submission looks automated.
 */
export function looksLikeSpam(input: { company?: string | undefined; elapsedMs?: number | undefined }): boolean {
  if (input.company) return true;
  if (input.elapsedMs !== undefined && input.elapsedMs < 1500) return true;
  return false;
}

/** Strip control characters (bar newlines/tabs) from free text before it is stored or emailed. */
export function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}
