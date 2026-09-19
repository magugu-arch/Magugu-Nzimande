import {
  SeenEventLedger,
  applyStatus,
  describeStatus,
  idempotencyKeyFor,
  isTerminalStatus,
  mapProviderStatus,
  normalizeOrderEvent,
  timelineFor,
  toProviderMode,
  fromProviderMode,
  type ProviderWebhook,
} from '@/integrations/delivery';

/**
 * Status mapping, the state machine, duplicate webhooks and idempotency.
 *
 * The other half of extension §10.10's required coverage. Every test here
 * exists because of a specific way a provider integration goes wrong in
 * production rather than in a type checker: events that arrive twice, events
 * that arrive out of order, events for a state the order has already passed,
 * and retries that become second orders.
 */

function webhook(over: Partial<ProviderWebhook> = {}): ProviderWebhook {
  return {
    provider: 'pappas-direct',
    eventId: 'evt-1',
    externalOrderId: 'ord-1',
    type: 'order.preparing',
    occurredAt: '2026-09-19T12:00:00Z',
    payload: {},
    ...over,
  };
}

describe('mapping a provider’s vocabulary into ours', () => {
  it('maps a known direct event', () => {
    expect(mapProviderStatus('pappas-direct', 'order.ready')).toBe('ready');
  });

  it('returns null for an event nobody has mapped', () => {
    // Not a default status. An order that silently moved to "submitted"
    // because a provider sent a receipt-emailed event is worse than one that
    // did not move at all.
    expect(mapProviderStatus('pappas-direct', 'order.receipt_emailed')).toBeNull();
  });

  it('maps nothing at all for the external channels yet, and says so honestly', () => {
    // Extension §10.12: do not invent provider contracts. Nobody has told us
    // what Uber Eats calls the moment a courier collects an order, so the
    // table is empty and the gap is visible rather than guessed.
    expect(mapProviderStatus('uber-eats', 'order.picked_up')).toBeNull();
    expect(mapProviderStatus('mr-d', 'delivery.completed')).toBeNull();
  });
});

describe('duplicate webhooks', () => {
  it('admits an event once and refuses the resend', () => {
    const ledger = new SeenEventLedger();
    expect(normalizeOrderEvent(webhook(), ledger).ok).toBe(true);
    expect(normalizeOrderEvent(webhook(), ledger)).toMatchObject({
      ok: false,
      kind: 'duplicate',
    });
  });

  it('treats a different event on the same order as new', () => {
    const ledger = new SeenEventLedger();
    normalizeOrderEvent(webhook({ eventId: 'evt-1', type: 'order.preparing' }), ledger);
    const second = normalizeOrderEvent(
      webhook({ eventId: 'evt-2', type: 'order.ready' }),
      ledger,
    );
    expect(second.ok).toBe(true);
  });

  it('reports a duplicate as a duplicate even when the event is unmapped', () => {
    const ledger = new SeenEventLedger();
    const first = normalizeOrderEvent(webhook({ type: 'order.unknown' }), ledger);
    expect(first).toMatchObject({ ok: false, kind: 'unmapped' });
    expect(normalizeOrderEvent(webhook({ type: 'order.unknown' }), ledger)).toMatchObject({
      kind: 'duplicate',
    });
  });

  it('forgets the oldest ids rather than growing without limit', () => {
    const ledger = new SeenEventLedger(2);
    ledger.admit('a');
    ledger.admit('b');
    ledger.admit('c');
    expect(ledger.has('a')).toBe(false);
    expect(ledger.has('c')).toBe(true);
  });

  it('rejects a malformed event before it can occupy a ledger slot', () => {
    const ledger = new SeenEventLedger();
    expect(normalizeOrderEvent(webhook({ occurredAt: 'soon' }), ledger)).toMatchObject({
      ok: false,
      kind: 'malformed',
    });
    expect(ledger.has('evt-1')).toBe(false);
  });
});

describe('what a webhook payload is allowed to tell us', () => {
  it('passes through an ETA the provider actually supplied', () => {
    const result = normalizeOrderEvent(
      webhook({ payload: { etaMinutes: 32 } }),
      new SeenEventLedger(),
    );
    expect(result).toMatchObject({ ok: true, event: { etaMinutes: 32 } });
  });

  it('drops an absurd ETA rather than promising a four-hour wait', () => {
    const result = normalizeOrderEvent(
      webhook({ payload: { etaMinutes: 900 } }),
      new SeenEventLedger(),
    );
    expect(result.ok && result.event.etaMinutes).toBeUndefined();
  });

  it('refuses a tracking URL that is not https', () => {
    // This value ends up in Linking.openURL. A javascript: or custom-scheme
    // URL from an untrusted webhook is an open redirect into whatever else is
    // installed on the phone.
    const result = normalizeOrderEvent(
      webhook({ payload: { trackingUrl: 'javascript:alert(1)' } }),
      new SeenEventLedger(),
    );
    expect(result.ok && result.event.trackingUrl).toBeUndefined();
  });

  it('keeps a real https tracking URL', () => {
    const result = normalizeOrderEvent(
      webhook({ payload: { trackingUrl: 'https://track.example/abc' } }),
      new SeenEventLedger(),
    );
    expect(result).toMatchObject({ ok: true, event: { trackingUrl: 'https://track.example/abc' } });
  });
});

describe('the canonical state machine', () => {
  it('moves forward', () => {
    expect(applyStatus('preparing', 'ready', 'delivery')).toEqual({
      applied: true,
      status: 'ready',
    });
  });

  it('refuses to go backwards when events arrive out of order', () => {
    // Two providers do not share a clock, and events dispatched half a second
    // apart can land either way round.
    expect(applyStatus('out-for-delivery', 'preparing', 'delivery')).toMatchObject({
      applied: false,
      status: 'out-for-delivery',
      rejection: 'not-forward',
    });
  });

  it('lets a cancellation land from anywhere', () => {
    expect(applyStatus('preparing', 'cancelled', 'delivery')).toEqual({
      applied: true,
      status: 'cancelled',
    });
  });

  it('never reopens a finished order', () => {
    // A late "preparing" after delivery must not restart the timeline.
    expect(applyStatus('delivered', 'preparing', 'delivery')).toMatchObject({
      applied: false,
      rejection: 'already-terminal',
    });
    expect(applyStatus('cancelled', 'delivered', 'delivery')).toMatchObject({
      applied: false,
      rejection: 'already-terminal',
    });
  });

  it('refuses a courier state on a collection order', () => {
    // A mapping bug, not a state to render: a collection customer must never
    // be shown a driver who does not exist.
    expect(applyStatus('ready', 'out-for-delivery', 'pickup')).toMatchObject({
      applied: false,
      rejection: 'mode-mismatch',
    });
  });

  it('knows which states are final', () => {
    expect(isTerminalStatus('delivered')).toBe(true);
    expect(isTerminalStatus('ready')).toBe(false);
  });
});

describe('the words a customer reads', () => {
  it('says “Ready for collection” on a collection order', () => {
    expect(describeStatus('ready', 'pickup').label).toBe('Ready for collection');
  });

  it('says “Your courier is on the way” on a delivery', () => {
    expect(describeStatus('out-for-delivery', 'delivery').detail).toBe(
      'Your courier is on the way to you.',
    );
  });

  it('tells a customer whose order failed that they were not charged', () => {
    expect(describeStatus('failed', 'delivery').detail).toMatch(/not been charged/);
  });

  it('draws no courier steps in a collection timeline', () => {
    expect(timelineFor('pickup')).not.toContain('out-for-delivery');
    expect(timelineFor('delivery')).toContain('out-for-delivery');
  });
});

describe('bridging the app’s fulfilment words to the providers’', () => {
  it('maps collection to pickup and back', () => {
    expect(toProviderMode('collection')).toBe('pickup');
    expect(fromProviderMode('pickup')).toBe('collection');
  });

  it('refuses to turn a dine-in booking into a delivery mode', () => {
    // A cast would have done this silently and let a table reservation be
    // quoted a courier fee.
    expect(toProviderMode('dinein')).toBeNull();
  });
});

describe('idempotency keys', () => {
  const intent = {
    provider: 'pappas-direct',
    storeId: 'square',
    customerId: 'cust-1',
    fulfilment: 'delivery',
    totalCents: 42_000,
    items: [{ sku: 'a', quantity: 1 }, { sku: 'b', quantity: 2 }],
  };
  const now = Date.parse('2026-09-19T12:00:00Z');

  it('gives a retry of the same order the same key', () => {
    // The whole point: a timeout followed by a retry must not cook dinner
    // twice.
    expect(idempotencyKeyFor(intent, now)).toBe(idempotencyKeyFor(intent, now + 1000));
  });

  it('ignores the order the cart happens to be in', () => {
    const reversed = { ...intent, items: [...intent.items].reverse() };
    expect(idempotencyKeyFor(reversed, now)).toBe(idempotencyKeyFor(intent, now));
  });

  it('gives a different key to a different order', () => {
    expect(idempotencyKeyFor({ ...intent, totalCents: 43_000 }, now)).not.toBe(
      idempotencyKeyFor(intent, now),
    );
  });

  it('lets the same order through again after the commit window', () => {
    // A customer who genuinely wants the same dishes an hour later is not
    // told they already ordered.
    expect(idempotencyKeyFor(intent, now + 20 * 60 * 1000)).not.toBe(
      idempotencyKeyFor(intent, now),
    );
  });

  it('separates channels, so the same cart on two channels is two orders', () => {
    expect(idempotencyKeyFor({ ...intent, provider: 'uber-eats' }, now)).not.toBe(
      idempotencyKeyFor(intent, now),
    );
  });
});
