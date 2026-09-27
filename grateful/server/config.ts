/**
 * Server configuration, read from the environment on each call so tests can
 * change it. Nothing here is ever bundled for the browser: only files under
 * src/ reach the client, and only VITE_-prefixed variables are exposed there.
 * See .env.example for every variable and what it does.
 */

const env = (key: string): string | undefined => {
  const v = process.env[key];
  return v === undefined || v === '' ? undefined : v;
};

export function config() {
  const isProduction = env('NODE_ENV') === 'production' || env('VERCEL_ENV') === 'production';
  return {
    isProduction,
    siteUrl: (env('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, ''),

    database: env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY') ? 'supabase' : ('memory' as 'supabase' | 'memory'),
    supabaseUrl: env('SUPABASE_URL'),
    supabaseServiceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),

    paymentProvider: (env('PAYMENT_PROVIDER') ?? 'mock') as 'payfast' | 'mock',
    /** The mock gateway refuses to run in production unless this is set. */
    allowMockPayments: env('ALLOW_MOCK_PAYMENTS') === 'true',
    payfast: {
      merchantId: env('PAYFAST_MERCHANT_ID'),
      merchantKey: env('PAYFAST_MERCHANT_KEY'),
      passphrase: env('PAYFAST_PASSPHRASE'),
      sandbox: env('PAYFAST_SANDBOX') !== 'false',
      /** Behind a proxy that hides the caller's IP, the source check cannot work. */
      verifySourceIp: env('PAYFAST_VERIFY_SOURCE_IP') !== 'false',
    },

    emailProvider: (env('EMAIL_PROVIDER') ?? 'console') as 'resend' | 'console',
    resendApiKey: env('RESEND_API_KEY'),
    emailFrom: env('EMAIL_FROM') ?? 'Grateful <bookings@example.com>',
    studioEmail: env('STUDIO_EMAIL') ?? 'gratefulpty@gmail.com',

    /** Signs newsletter unsubscribe links. Required in production. */
    newsletterSecret: env('NEWSLETTER_SECRET'),

    /** Bearer token for /api/admin/*. Unset → admin endpoints are disabled. */
    adminToken: env('ADMIN_TOKEN'),

    booking: {
      holdMinutes: Number(env('BOOKING_HOLD_MINUTES') ?? 20),
      slotStepMinutes: Number(env('SLOT_STEP_MINUTES') ?? 30),
      minNoticeHours: Number(env('MIN_NOTICE_HOURS') ?? 24),
      bookingWindowDays: Number(env('BOOKING_WINDOW_DAYS') ?? 60),
    },

    /** Local development only: give the in-memory services sample prices to exercise checkout. */
    demoPricing: env('DEMO_PRICING') === 'true' && !isProduction,
  };
}

export type Config = ReturnType<typeof config>;
