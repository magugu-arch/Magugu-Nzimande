import { describe, expect, it } from 'vitest';
import { route } from './router';
import { checkLaunchConfig, launchReady } from './launch';

const live = {
  SITE_URL: 'https://grateful.co.za',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  PAYMENT_PROVIDER: 'payfast',
  PAYFAST_MERCHANT_ID: '10000100',
  PAYFAST_MERCHANT_KEY: 'key',
  PAYFAST_PASSPHRASE: 'pass',
  PAYFAST_SANDBOX: 'false',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_123',
  EMAIL_FROM: 'Grateful <bookings@grateful.co.za>',
  ADMIN_TOKEN: 'x'.repeat(32),
  NEWSLETTER_SECRET: 'y'.repeat(40),
  CRON_SECRET: 'z'.repeat(20),
  GOOGLE_SITE_VERIFICATION: 'search-console-token',
};

describe('launch readiness', () => {
  it('passes a complete live configuration', () => {
    const checks = checkLaunchConfig(live);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(launchReady(checks)).toBe(true);
  });

  it('flags the development defaults that must not go live', () => {
    const failing = checkLaunchConfig({ SITE_URL: 'http://localhost:5173', PAYMENT_PROVIDER: 'mock', EMAIL_FROM: 'Grateful <bookings@example.com>', ADMIN_TOKEN: 'short', DEMO_PRICING: 'true' })
      .filter((c) => !c.ok)
      .map((c) => c.id);
    expect(failing).toEqual(expect.arrayContaining(['site-url', 'database', 'payments', 'email-from', 'studio-key', 'newsletter-secret', 'no-demo']));
  });

  it('is still ready with only recommended items outstanding (sandbox payments, no reminders)', () => {
    expect(launchReady(checkLaunchConfig({ ...live, PAYFAST_SANDBOX: 'true', CRON_SECRET: '' }))).toBe(true);
  });

  it('reports health as pass/fail only, never a value', async () => {
    const res = await route({ method: 'GET', path: '/api/health', query: new URLSearchParams(), headers: {}, ip: '1.1.1.1', rawBody: '' });
    expect(res.status).toBe(503); // the test environment is not a live one
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/localhost|example\.com|http/);
    expect(res.body).toMatchObject({ ready: false });
  });
});
