import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { events } from '@/content/events';
import {
  BOOKING_REFERENCE,
  bookingAvailability,
  bookingMode,
  bookingReference,
  formatUsd,
  orderTotal,
} from '@/lib/booking';
import { getBookableEvents } from '@/lib/content';
import {
  checkoutParams,
  createCheckoutSession,
  encodeForm,
  paymentsState,
  retrieveCheckoutSession,
  StripeError,
  verifyWebhookSignature,
} from '@/lib/payments';
import { bookingSchema } from '@/lib/validation';

const NOW = Date.parse('2026-10-14T12:00:00Z');

const event = {
  booking: { status: 'open' as const, ticketName: 'Seat', priceCents: 5000, maxPerOrder: 4 },
  end: '2026-11-19T19:30:00-06:00',
  registrationCutoff: null,
  ticketUrl: null,
};

describe('booking rules', () => {
  it('picks the mode from the price alone', () => {
    expect(bookingMode({ priceCents: 2500 })).toBe('paid');
    expect(bookingMode({ priceCents: 0 })).toBe('free');
    expect(bookingMode({ priceCents: null })).toBe('request');
  });

  it('is open only for upcoming events with booking switched on', () => {
    expect(bookingAvailability(event, NOW)).toBe('open');
    expect(bookingAvailability({ ...event, booking: null }, NOW)).toBe('none');
    expect(bookingAvailability({ ...event, ticketUrl: 'https://tickets.example' }, NOW)).toBe(
      'none',
    );
    expect(bookingAvailability(event, Date.parse('2026-11-20T02:00:00Z'))).toBe('ended');
    expect(
      bookingAvailability({ ...event, booking: { ...event.booking, status: 'sold-out' } }, NOW),
    ).toBe('sold-out');
    expect(bookingAvailability({ ...event, registrationCutoff: '2026-10-01T00:00:00Z' }, NOW)).toBe(
      'cutoff-passed',
    );
  });

  it('totals in cents and formats US dollars', () => {
    expect(orderTotal({ priceCents: 10000 }, 3)).toBe(30000);
    expect(orderTotal({ priceCents: null }, 3)).toBeNull();
    expect(formatUsd(30000)).toBe('$300.00');
    expect(formatUsd(1999)).toBe('$19.99');
  });

  it('makes readable references without look-alike characters', () => {
    const ref = bookingReference();
    expect(ref).toMatch(BOOKING_REFERENCE);
    expect(ref).not.toMatch(/[01IO]/);
    expect(bookingReference(() => 0)).toBe('MG-AAAA-AAAA');
  });
});

describe('demo events', () => {
  it('only demo events carry prices, and every past fixture has booking off', () => {
    for (const e of events) {
      if (e.booking?.priceCents) expect(e.isDemo, e.id).toBe(true);
      if (Date.parse(e.end) < NOW) expect(e.booking, e.id).toBeNull();
    }
  });

  it('none are bookable in production', () => {
    expect(getBookableEvents('production')).toEqual([]);
    expect(getBookableEvents('preview').length).toBeGreaterThan(0);
  });
});

describe('booking form schema', () => {
  const valid = {
    eventSlug: 'business-growth-workshop',
    quantity: '2',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    consent: 'on',
  };

  it('accepts a complete booking and coerces the seat count', () => {
    const parsed = bookingSchema.parse(valid);
    expect(parsed.quantity).toBe(2);
    expect(parsed.intent).toBe('pay');
    expect(parsed.phone).toBeUndefined();
  });

  it('refuses missing consent, bad seat counts and odd phone numbers', () => {
    expect(bookingSchema.safeParse({ ...valid, consent: undefined }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, quantity: '0' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, quantity: '1.5' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, quantity: '99' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, phone: 'call me' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, phone: '+1 (312) 555-0100' }).success).toBe(true);
  });

  it('never reads a price from the form', () => {
    const parsed = bookingSchema.parse({ ...valid, priceCents: '1', amount: '1' });
    expect(parsed).not.toHaveProperty('priceCents');
    expect(parsed).not.toHaveProperty('amount');
  });
});

describe('payments readiness', () => {
  const dest = { BOOKING_WEBHOOK_URL: 'https://hooks.example/booking' };

  it('stays off without a usable key', () => {
    expect(paymentsState({}, 'preview')).toEqual({ ready: false, reason: 'no-key' });
    expect(paymentsState({ STRIPE_SECRET_KEY: 'pk_test_123' }, 'preview')).toEqual({
      ready: false,
      reason: 'invalid-key',
    });
  });

  it('takes test payments in preview only', () => {
    expect(paymentsState({ STRIPE_SECRET_KEY: 'sk_test_abc' }, 'preview')).toMatchObject({
      ready: true,
      mode: 'test',
    });
    expect(paymentsState({ STRIPE_SECRET_KEY: 'sk_test_abc', ...dest }, 'production')).toEqual({
      ready: false,
      reason: 'test-key-in-production',
    });
  });

  it('needs production, explicit approval and a booking destination for live payments', () => {
    const live = { STRIPE_SECRET_KEY: 'sk_live_abc' };
    expect(paymentsState(live, 'preview')).toEqual({ ready: false, reason: 'live-not-approved' });
    expect(paymentsState({ ...live, ...dest }, 'production')).toEqual({
      ready: false,
      reason: 'live-not-approved',
    });
    expect(paymentsState({ ...live, PAYMENTS_LIVE_APPROVED: 'true' }, 'production')).toEqual({
      ready: false,
      reason: 'no-booking-destination',
    });
    expect(
      paymentsState({ ...live, ...dest, PAYMENTS_LIVE_APPROVED: 'true' }, 'production'),
    ).toMatchObject({ ready: true, mode: 'live' });
  });
});

describe('Stripe client', () => {
  const input = {
    reference: 'MG-ABCD-EFGH',
    eventId: 'evt-1',
    eventSlug: 'workshop',
    productName: 'Workshop — General admission',
    productDescription: 'Thursday · 9:00 AM · Online',
    unitAmountCents: 10000,
    quantity: 2,
    email: 'ada@example.com',
    successUrl: 'https://site.example/bookings/confirmed?session_id={CHECKOUT_SESSION_ID}',
    cancelUrl: 'https://site.example/bookings/cancelled',
    now: 1_800_000_000,
  };

  it('encodes nested params the way Stripe expects', () => {
    const form = encodeForm(checkoutParams(input));
    expect(form.get('mode')).toBe('payment');
    expect(form.get('line_items[0][quantity]')).toBe('2');
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('10000');
    expect(form.get('line_items[0][price_data][currency]')).toBe('usd');
    expect(form.get('metadata[bookingRef]')).toBe('MG-ABCD-EFGH');
    expect(form.get('expires_at')).toBe(String(1_800_000_000 + 3600));
    // Personal details stay with the team, not in Stripe metadata.
    expect(
      [...form.keys()].some((k) => /name\]|phone|access/i.test(k) && k.startsWith('meta')),
    ).toBe(false);
  });

  it('posts with the secret key and an idempotency key per booking', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: 'cs_test_a1b2c3d4e5f6', url: 'https://checkout.stripe.com/c/pay/x' }),
    );
    const session = await createCheckoutSession(
      { secretKey: 'sk_test_abc', fetch: fetchMock as unknown as typeof fetch },
      input,
    );
    expect(session.url).toContain('checkout.stripe.com');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk_test_abc');
    expect(headers['idempotency-key']).toBe('checkout-MG-ABCD-EFGH');
  });

  it('turns Stripe errors into StripeError and checks session ids before asking', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { error: { message: 'No such price', code: 'resource_missing' } },
        { status: 400 },
      ),
    );
    const client = { secretKey: 'sk_test_abc', fetch: fetchMock as unknown as typeof fetch };
    await expect(createCheckoutSession(client, input)).rejects.toBeInstanceOf(StripeError);
    await expect(retrieveCheckoutSession(client, '../../v1/charges')).rejects.toBeInstanceOf(
      StripeError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('webhook signatures', () => {
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const t = 1_800_000_000;
  const sign = (body: string, ts = t, key = secret) =>
    createHmac('sha256', key).update(`${ts}.${body}`).digest('hex');
  const now = t * 1000;

  it('accepts a correct, fresh signature', () => {
    expect(verifyWebhookSignature(payload, `t=${t},v1=${sign(payload)}`, secret, { now })).toBe(
      true,
    );
    // Rolled secrets send several v1 values; any match is enough.
    expect(
      verifyWebhookSignature(payload, `t=${t},v1=${'0'.repeat(64)},v1=${sign(payload)}`, secret, {
        now,
      }),
    ).toBe(true);
  });

  it('rejects tampering, wrong secrets, replays and junk', () => {
    expect(
      verifyWebhookSignature(`${payload} `, `t=${t},v1=${sign(payload)}`, secret, { now }),
    ).toBe(false);
    expect(
      verifyWebhookSignature(payload, `t=${t},v1=${sign(payload, t, 'other')}`, secret, { now }),
    ).toBe(false);
    expect(
      verifyWebhookSignature(payload, `t=${t},v1=${sign(payload)}`, secret, {
        now: now + 301_000,
      }),
    ).toBe(false);
    expect(verifyWebhookSignature(payload, null, secret, { now })).toBe(false);
    expect(verifyWebhookSignature(payload, 'v1=abc', secret, { now })).toBe(false);
    expect(verifyWebhookSignature(payload, `t=${t},v1=zz`, secret, { now })).toBe(false);
  });
});
