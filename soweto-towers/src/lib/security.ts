import 'server-only';
import { headers } from 'next/headers';

/**
 * Per-IP fixed-window rate limits. In-memory, so each server instance counts
 * separately: enough to blunt scripted abuse of forms and code lookups. Behind
 * several instances, swap for a shared store (README → Hardening).
 */
const buckets = new Map<string, { count: number; reset: number }>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('cf-connecting-ip') ?? '0.0.0.0';
}

export async function rateLimit(name: string, limit: number, windowSeconds: number): Promise<boolean> {
  const key = `${name}:${await clientIp()}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowSeconds * 1000 });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.count++;
  return b.count <= limit;
}

/**
 * A filled honeypot, or a form sent within 1.5 seconds of the page appearing
 * (faster than a person can read and fill it). Callers answer bots with a
 * normal-looking success so they learn nothing.
 */
export function looksLikeBot(form: FormData): boolean {
  if (String(form.get('company_website') ?? '').length > 0) return true;
  const started = Number(form.get('started_at') ?? 0);
  return started > 0 && Date.now() - started < 1500;
}

/** Marketing attribution captured by the proxy from ?ref=, ?src= or UTM tags. */
export async function attribution(): Promise<{ source: string | null; partner: string | null }> {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  return {
    source: jar.get('st_src')?.value?.slice(0, 60) ?? null,
    partner: jar.get('st_partner')?.value?.slice(0, 40) ?? null,
  };
}
