import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { type SiteMode, SITE_MODE } from './env';

/**
 * Payments through Stripe Checkout: this site creates a Checkout Session and
 * sends the visitor to Stripe's hosted page, so card details never touch it.
 * Stripe's REST API is called directly with fetch — two endpoints and the
 * webhook signature are all the site needs.
 *
 * The brief's rule is that live payments are never connected without the
 * owner's approval, so readiness is deliberately strict:
 *
 * - no key, or a key that is not a Stripe secret/restricted key → off
 * - a live key is refused unless the site is in production AND
 *   PAYMENTS_LIVE_APPROVED=true, set on purpose by whoever holds that approval
 * - a test key is refused in production, where it would take fake payments
 * - production also needs somewhere to record bookings (the booking webhook),
 *   so nobody can pay for a seat the team never hears about
 */

type Env = Record<string, string | undefined>;

export type PaymentsBlock =
  | 'no-key'
  | 'invalid-key'
  | 'live-not-approved'
  | 'test-key-in-production'
  | 'no-booking-destination';

export type PaymentsState =
  | { ready: true; mode: 'test' | 'live'; secretKey: string }
  | { ready: false; reason: PaymentsBlock };

export function paymentsState(
  env: Env = process.env,
  siteMode: SiteMode = SITE_MODE,
): PaymentsState {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) return { ready: false, reason: 'no-key' };
  const mode = /^(sk|rk)_live_/.test(key) ? 'live' : /^(sk|rk)_test_/.test(key) ? 'test' : null;
  if (!mode) return { ready: false, reason: 'invalid-key' };
  if (mode === 'live' && (siteMode !== 'production' || env.PAYMENTS_LIVE_APPROVED !== 'true')) {
    return { ready: false, reason: 'live-not-approved' };
  }
  if (mode === 'test' && siteMode === 'production') {
    return { ready: false, reason: 'test-key-in-production' };
  }
  if (
    siteMode === 'production' &&
    !(env.BOOKING_WEBHOOK_URL || env.ORDER_WEBHOOK_URL || env.ENQUIRY_WEBHOOK_URL)
  ) {
    return { ready: false, reason: 'no-booking-destination' };
  }
  return { ready: true, mode, secretKey: key };
}

/** For people configuring the site (preview notices and the review page), never the public. */
export const paymentsBlockText: Record<PaymentsBlock, string> = {
  'no-key': 'No Stripe key is set (STRIPE_SECRET_KEY), so checkout stays off.',
  'invalid-key': 'STRIPE_SECRET_KEY is not a Stripe secret or restricted key.',
  'live-not-approved':
    'A live Stripe key is set, but live payments need production mode and PAYMENTS_LIVE_APPROVED=true.',
  'test-key-in-production': 'A Stripe test key cannot take payments on the production site.',
  'no-booking-destination':
    'Production needs BOOKING_WEBHOOK_URL, ORDER_WEBHOOK_URL or ENQUIRY_WEBHOOK_URL so paid bookings and orders are recorded.',
};

// ---------------------------------------------------------------- Stripe API

/**
 * STRIPE_API_BASE points the client at a local mock (stripe-mock or a test
 * double) for end-to-end runs. Ignored in production.
 */
function apiBase(): string {
  const override = SITE_MODE === 'production' ? undefined : process.env.STRIPE_API_BASE;
  return (override || 'https://api.stripe.com/v1').replace(/\/+$/, '');
}

export const CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,250}$/;

/** The fields of a Checkout Session this site reads. */
export interface CheckoutSession {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired' | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  customer_email: string | null;
  customer_details: { email: string | null } | null;
  metadata: Record<string, string> | null;
  livemode: boolean;
}

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

export interface StripeClient {
  secretKey: string;
  /** Injected in tests. */
  fetch?: typeof fetch;
}

/** Stripe's form encoding: nested objects and arrays become bracketed keys. */
export function encodeForm(
  params: Record<string, unknown>,
  prefix = '',
  out = new URLSearchParams(),
): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          encodeForm(item as Record<string, unknown>, `${name}[${i}]`, out);
        } else out.append(`${name}[${i}]`, String(item));
      });
    } else if (typeof value === 'object') {
      encodeForm(value as Record<string, unknown>, name, out);
    } else out.append(name, String(value));
  }
  return out;
}

async function request<T>(
  client: StripeClient,
  method: 'GET' | 'POST',
  path: string,
  options: { body?: URLSearchParams; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { authorization: `Bearer ${client.secretKey}` };
  if (options.body) headers['content-type'] = 'application/x-www-form-urlencoded';
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
  // Pin the API version once the account is set up; unset uses the account default.
  if (process.env.STRIPE_API_VERSION) headers['stripe-version'] = process.env.STRIPE_API_VERSION;

  const res = await (client.fetch ?? fetch)(`${apiBase()}${path}`, {
    method,
    headers,
    body: options.body?.toString(),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as {
    error?: { message?: string; code?: string };
  } | null;
  if (!res.ok) {
    throw new StripeError(
      json?.error?.message ?? `Stripe answered ${res.status}`,
      res.status,
      json?.error?.code,
    );
  }
  return json as T;
}

export interface CheckoutInput {
  reference: string;
  eventId: string;
  eventSlug: string;
  /** Shown on Stripe's page and the receipt: event title and seat name. */
  productName: string;
  /** Date, time and place, under the product name. */
  productDescription: string;
  unitAmountCents: number;
  quantity: number;
  email: string;
  successUrl: string;
  cancelUrl: string;
  /** Unix seconds; the session expires an hour later. */
  now?: number;
}

/**
 * Only what Stripe needs: the booking reference ties the payment to the
 * details already sent to the team, so names, phone numbers and access needs
 * never sit in Stripe metadata.
 */
export function checkoutParams(input: CheckoutInput): Record<string, unknown> {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const metadata = {
    kind: 'event',
    bookingRef: input.reference,
    eventId: input.eventId,
    eventSlug: input.eventSlug,
    quantity: String(input.quantity),
  };
  return {
    mode: 'payment',
    submit_type: 'book',
    client_reference_id: input.reference,
    customer_email: input.email,
    line_items: [
      {
        quantity: input.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: input.unitAmountCents,
          product_data: { name: input.productName, description: input.productDescription },
        },
      },
    ],
    metadata,
    payment_intent_data: { description: `${input.productName} (${input.reference})`, metadata },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    expires_at: now + 60 * 60,
  };
}

export function createCheckoutSession(
  client: StripeClient,
  input: CheckoutInput,
): Promise<CheckoutSession> {
  return request<CheckoutSession>(client, 'POST', '/checkout/sessions', {
    body: encodeForm(checkoutParams(input)),
    // A retried submit of the same booking cannot open a second session.
    idempotencyKey: `checkout-${input.reference}`,
  });
}

// ---------------------------------------------------------------- Book orders

/**
 * Physical books need an address and a shipping charge. The owner creates
 * the shipping rate in the Stripe dashboard (it holds the price, so none is
 * written here) and sets its id; production refuses book checkout without
 * one. SHOP_SHIP_TO lists the countries to ship to (default: US).
 */
export function shippingSetup(env: Env = process.env): {
  rateId: string | null;
  countries: string[];
} {
  const rate = env.STRIPE_SHIPPING_RATE_ID?.trim();
  const countries = (env.SHOP_SHIP_TO || 'US')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return {
    rateId: rate && /^shr_[A-Za-z0-9]+$/.test(rate) ? rate : null,
    countries: countries.length > 0 ? countries : ['US'],
  };
}

export interface BookOrderInput {
  reference: string;
  lines: { slug: string; title: string; unitAmountCents: number; quantity: number }[];
  shipping: { rateId: string | null; countries: string[] };
  successUrl: string;
  cancelUrl: string;
  /** Unix seconds; the session expires an hour later. */
  now?: number;
}

/** Only slugs and quantities go into metadata; Stripe collects the buyer's details itself. */
export function bookOrderParams(input: BookOrderInput): Record<string, unknown> {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const metadata = {
    kind: 'books',
    orderRef: input.reference,
    items: input.lines.map((l) => `${l.slug}:${l.quantity}`).join(','),
  };
  return {
    mode: 'payment',
    submit_type: 'pay',
    client_reference_id: input.reference,
    line_items: input.lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: l.unitAmountCents,
        product_data: { name: l.title, description: 'Book' },
      },
    })),
    shipping_address_collection: { allowed_countries: input.shipping.countries },
    shipping_options: input.shipping.rateId
      ? [{ shipping_rate: input.shipping.rateId }]
      : undefined,
    phone_number_collection: { enabled: true },
    metadata,
    payment_intent_data: { description: `Book order ${input.reference}`, metadata },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    expires_at: now + 60 * 60,
  };
}

export function createBookOrderSession(
  client: StripeClient,
  input: BookOrderInput,
): Promise<CheckoutSession> {
  return request<CheckoutSession>(client, 'POST', '/checkout/sessions', {
    body: encodeForm(bookOrderParams(input)),
    idempotencyKey: `order-${input.reference}`,
  });
}

export function retrieveCheckoutSession(
  client: StripeClient,
  id: string,
): Promise<CheckoutSession> {
  if (!CHECKOUT_SESSION_ID.test(id)) {
    return Promise.reject(new StripeError('Not a Checkout Session id', 400));
  }
  return request<CheckoutSession>(client, 'GET', `/checkout/sessions/${id}`);
}

// ---------------------------------------------------------------- Webhooks

/**
 * Checks a `Stripe-Signature` header: HMAC-SHA256 of `${t}.${payload}` with
 * the endpoint secret, compared in constant time, and rejected when the
 * timestamp is more than `toleranceSeconds` from now (replay protection).
 */
export function verifyWebhookSignature(
  payload: string,
  header: string | null,
  secret: string,
  options: { toleranceSeconds?: number; now?: number } = {},
): boolean {
  if (!header || !secret) return false;
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.now ?? Date.now();

  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't') timestamp = value;
    else if (key === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > tolerance) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest();
  return signatures.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig)) return false;
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
