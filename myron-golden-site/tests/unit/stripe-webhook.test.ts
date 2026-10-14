import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deliver = vi.fn();
vi.mock('@/lib/delivery', () => ({ deliver: (...args: unknown[]) => deliver(...args) }));

const { POST } = await import('@/app/api/stripe/webhook/route');

const secret = 'whsec_unit';

function signedRequest(body: unknown, key = secret) {
  const payload = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', key).update(`${t}.${payload}`).digest('hex');
  return new Request('https://site.example/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${t},v1=${sig}` },
    body: payload,
  });
}

const completed = (paymentStatus: string) => ({
  id: 'evt_123',
  type: 'checkout.session.completed',
  livemode: false,
  data: {
    object: {
      id: 'cs_test_abcdefghijkl',
      payment_status: paymentStatus,
      amount_total: 20000,
      currency: 'usd',
      client_reference_id: 'MG-ABCD-EFGH',
      payment_intent: 'pi_123',
      customer_details: { email: 'ada@example.com' },
      metadata: {
        eventSlug: 'workshop',
        eventId: 'evt-1',
        quantity: '2',
        bookingRef: 'MG-ABCD-EFGH',
      },
    },
  },
});

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  deliver.mockReset();
  deliver.mockResolvedValue({ ok: true, channel: 'webhook' });
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe('Stripe webhook', () => {
  it('is unavailable until a signing secret is configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(signedRequest(completed('paid')));
    expect(res.status).toBe(503);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('rejects requests not signed with the endpoint secret', async () => {
    const res = await POST(signedRequest(completed('paid'), 'whsec_wrong'));
    expect(res.status).toBe(400);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('records a paid checkout against its booking reference', async () => {
    const res = await POST(signedRequest(completed('paid')));
    expect(res.status).toBe(200);
    expect(deliver).toHaveBeenCalledWith(
      'booking',
      expect.objectContaining({
        stage: 'paid',
        reference: 'MG-ABCD-EFGH',
        quantity: 2,
        amountTotalCents: 20000,
        stripeEventId: 'evt_123',
      }),
      { sourcePage: '/api/stripe/webhook' },
    );
  });

  it('waits for settlement when a payment is still processing', async () => {
    const res = await POST(signedRequest(completed('unpaid')));
    expect(res.status).toBe(200);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('answers 500 when the booking cannot be recorded, so Stripe retries', async () => {
    deliver.mockResolvedValue({ ok: false, reason: 'failed' });
    const res = await POST(signedRequest(completed('paid')));
    expect(res.status).toBe(500);
  });
});
