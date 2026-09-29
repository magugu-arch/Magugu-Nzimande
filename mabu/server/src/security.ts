/**
 * The guard rails around the API: what every response tells the browser, how
 * much any one caller may ask for, and what a request body may look like.
 *
 * Each of these stops a class of attack outright rather than relying on the
 * service layer to be careful: headers stop a page framing or sniffing the
 * API, the limiter stops a script hammering it, and the body guard stops a
 * small payload costing a lot of memory to parse.
 */
import { randomBytes } from 'node:crypto';

/** Request bodies are small — a booking is a few hundred bytes. */
export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_JSON_DEPTH = 12;
export const MAX_JSON_NODES = 2_000;
export const MAX_STRING_LENGTH = 8_000;

export const requestId = () => randomBytes(8).toString('hex');

/**
 * A fixed window per key, with the seconds until it reopens so a caller can
 * be told when to come back instead of guessing.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  /** null when allowed; otherwise the seconds to wait. */
  check(key: string, now: number): number | null {
    this.sweep(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return null;
    }
    if (entry.count >= this.limit) return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    entry.count += 1;
    return null;
  }

  take(key: string, now: number): boolean {
    return this.check(key, now) === null;
  }

  /** Forget spent windows, so a long-running server does not grow a key per visitor. */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

/**
 * Rejects a body that is legal JSON but expensive: deeply nested, enormous, or
 * carrying a string no field of ours could want. `__proto__` and friends are
 * dropped so a parsed body can never reach an object's prototype.
 */
export function guardJson(value: unknown): unknown {
  let nodes = 0;
  const walk = (node: unknown, depth: number): unknown => {
    if (depth > MAX_JSON_DEPTH) throw new Error('body nested too deeply');
    if (++nodes > MAX_JSON_NODES) throw new Error('body has too many values');
    if (typeof node === 'string') {
      if (node.length > MAX_STRING_LENGTH) throw new Error('body has an oversized value');
      return node;
    }
    if (Array.isArray(node)) return node.map((v) => walk(v, depth + 1));
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(node)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        out[key] = walk(v, depth + 1);
      }
      return out;
    }
    return node;
  };
  return walk(value, 0);
}

export interface HeaderOptions {
  /** Set when the site is served over https, so HSTS is honest. */
  https: boolean;
  /** 'json' for the API, 'page' for the few HTML pages the server serves. */
  kind: 'json' | 'page';
  /** Where a payment page may post to (PayFast), for the page policy. */
  formAction?: string[];
}

/**
 * Headers every response carries. The API returns data, never a document, so
 * its policy allows nothing at all; the payment page may post to the gateway.
 */
export function securityHeaders({
  https,
  kind,
  formAction,
}: HeaderOptions): Record<string, string> {
  const csp =
    kind === 'json'
      ? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
      : [
          "default-src 'none'",
          "style-src 'unsafe-inline'",
          "script-src 'unsafe-inline'",
          "img-src 'self' data:",
          "base-uri 'none'",
          "frame-ancestors 'none'",
          `form-action ${(formAction ?? []).join(' ') || "'none'"}`,
        ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Permissions-Policy':
      'geolocation=(), camera=(), microphone=(), payment=(), interest-cohort=()',
    'Cache-Control': 'no-store',
    ...(https ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}

/** A client address that can be counted without keeping anyone's address. */
export function clientIp(headers: Record<string, string | string[] | undefined>, socket?: string) {
  const forwarded = headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (first?.split(',')[0]?.trim() || socket) ?? 'unknown';
}

/** A short, human label for a device, from its user agent. Never stored raw. */
export function deviceLabel(userAgent: string | undefined): string {
  const ua = (userAgent ?? '').slice(0, 300);
  if (!ua) return 'Unknown device';
  const app = /Expo|okhttp|CFNetwork/i.test(ua) ? 'Mábu app' : 'Browser';
  const os = /iPhone|iPad|iOS/i.test(ua)
    ? 'iPhone'
    : /Android/i.test(ua)
      ? 'Android'
      : /Mac OS X|Macintosh/i.test(ua)
        ? 'Mac'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'device';
  return `${app} on ${os}`;
}
