import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The security headers Vercel sends with every page (vercel.json). */
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const all = vercel.headers.find((h) => h.source === '/(.*)')!.headers;
const header = (key: string) => all.find((h) => h.key === key)?.value ?? '';
const csp = Object.fromEntries(
  header('Content-Security-Policy')
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .map(([name, ...values]) => [name, values]),
) as Record<string, string[]>;

describe('security headers', () => {
  it('only runs the site’s own scripts: no inline code, no eval', () => {
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(header('Content-Security-Policy')).not.toMatch(/unsafe-eval/);
  });

  it('lets the payment page send its form to both PayFast addresses the code uses', () => {
    const payfast = readFileSync('server/payments/payfast.ts', 'utf8');
    for (const host of payfast.match(/https:\/\/(?:www|sandbox)\.payfast\.co\.za/g) ?? []) expect(csp['form-action']).toContain(host);
    expect(csp['form-action']).toContain("'self'");
  });

  it('allows the Google map on the Contact page, and nothing may frame the site', () => {
    expect(csp['frame-src']).toEqual(['https://www.google.com']);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(header('X-Frame-Options')).toBe('DENY');
  });

  it('asks browsers to use HTTPS only', () => {
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d{7,}/);
  });
});
