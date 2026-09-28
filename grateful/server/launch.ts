/**
 * Is this environment ready to take real bookings and payments? A pure
 * function over the environment, so the same rules drive `npm run
 * check:launch` (full detail, run by whoever deploys) and GET /api/health
 * (pass/fail per check only, never a value). No imports: node runs this
 * file directly.
 */

export type LaunchCheck = { id: string; label: string; ok: boolean; level: 'required' | 'recommended'; fix: string };

export function checkLaunchConfig(env: Record<string, string | undefined>): LaunchCheck[] {
  const v = (k: string) => (env[k] ?? '').trim();
  const checks: LaunchCheck[] = [];
  const add = (id: string, label: string, ok: boolean, fix: string, level: LaunchCheck['level'] = 'required') => checks.push({ id, label, ok, level, fix });

  add('site-url', 'SITE_URL is the real https address', /^https:\/\/[^/]+\.[a-z]{2,}/i.test(v('SITE_URL')) && !/localhost|example/.test(v('SITE_URL')), 'Set SITE_URL to the live address, e.g. https://grateful.co.za. Emails and PayFast links are built from it.');
  add('database', 'Supabase is connected', !!v('SUPABASE_URL') && !!v('SUPABASE_SERVICE_ROLE_KEY'), 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and run supabase/setup-all.sql once in the Supabase SQL editor.');
  add('payments', 'Payments go through PayFast', v('PAYMENT_PROVIDER') === 'payfast' && !!v('PAYFAST_MERCHANT_ID') && !!v('PAYFAST_MERCHANT_KEY'), 'Set PAYMENT_PROVIDER=payfast, PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY.');
  add('payfast-passphrase', 'PayFast passphrase is set', !!v('PAYFAST_PASSPHRASE'), 'Set the same passphrase in PayFast (Settings → Developer) and in PAYFAST_PASSPHRASE.');
  add('payfast-live', 'PayFast is in live mode', v('PAYFAST_SANDBOX') === 'false', 'Leave PAYFAST_SANDBOX=true while testing; set it to false to take real money.', 'recommended');
  add('no-mock', 'The test payment gateway is off', v('ALLOW_MOCK_PAYMENTS') !== 'true', 'Remove ALLOW_MOCK_PAYMENTS.');
  add('email', 'Email goes through Resend', v('EMAIL_PROVIDER') === 'resend' && !!v('RESEND_API_KEY'), 'Set EMAIL_PROVIDER=resend and RESEND_API_KEY.');
  add('email-from', 'Emails come from a real, verified address', !!v('EMAIL_FROM') && !/example\.com|your-verified-domain/.test(v('EMAIL_FROM')), 'Set EMAIL_FROM to an address on a domain verified in Resend, e.g. "Grateful <bookings@grateful.co.za>".');
  add('studio-key', 'Studio key is long and random', v('ADMIN_TOKEN').length >= 24, 'Set ADMIN_TOKEN to a random string of at least 24 characters (npm run gen:secrets makes one). It unlocks the studio dashboard.');
  add('newsletter-secret', 'Unsubscribe links are signed', v('NEWSLETTER_SECRET').length >= 32, 'Set NEWSLETTER_SECRET to a random string of at least 32 characters.');
  add('cron', 'Day-before reminders are switched on', v('CRON_SECRET').length >= 16, 'Set CRON_SECRET (16+ characters). Vercel then calls /api/cron/reminders daily.', 'recommended');
  add('search-console', 'Google Search Console can verify the site', !!v('GOOGLE_SITE_VERIFICATION'), 'Add a URL-prefix property in Google Search Console, choose "HTML tag", and put its content value in GOOGLE_SITE_VERIFICATION (or verify by DNS instead).', 'recommended');
  add('no-demo', 'Sample prices are off', v('DEMO_PRICING') !== 'true', 'Remove DEMO_PRICING.');
  return checks;
}

export function launchReady(checks: LaunchCheck[]): boolean {
  return checks.every((c) => c.ok || c.level === 'recommended');
}
