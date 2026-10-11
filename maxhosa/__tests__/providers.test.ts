import { ASSET_IDS, assetRegistry } from '@/assets/registry.generated';
import { stageIndex, trackingView } from '@/domain/delivery';
import { MockBookingProvider } from '@/providers/booking/MockBookingProvider';
import { MockCommerceProvider } from '@/providers/commerce/MockCommerceProvider';
import { MockDeliveryProvider } from '@/providers/delivery/MockDeliveryProvider';
import catalogue from '@data/sample-catalogue.json';

describe('MockCommerceProvider', () => {
  const commerce = new MockCommerceProvider();

  it('serves only the verified images, and places every one of them', async () => {
    const products = await commerce.listProducts('ZA');
    const used = new Set<string>();
    for (const p of products) {
      expect(p.sample).toBe(true);
      for (const m of p.media) {
        expect(ASSET_IDS).toContain(m.assetId);
        expect(m.alt.length).toBeGreaterThan(20);
        used.add(m.assetId);
      }
    }
    for (const s of await commerce.listStories())
      [s.heroAssetId, ...s.mediaAssetIds].forEach((a) => used.add(a));
    for (const c of await commerce.listCategories()) used.add(c.assetId);
    expect([...used].sort()).toEqual([...ASSET_IDS].sort());
  });

  it('never states material, care or origin it was not given', async () => {
    const p = (await commerce.getProduct('p01', 'ZA'))!;
    expect(p.material).toBeUndefined();
    expect(p.care).toBeUndefined();
    expect(p.origin).toBeUndefined();
  });

  it('prices each market from its own list, not by conversion', async () => {
    const za = (await commerce.getProduct('p03', 'ZA'))!.price;
    const gb = (await commerce.getProduct('p03', 'GB'))!.price;
    expect(za).toEqual({ amount: '3200.00', currencyCode: 'ZAR' });
    expect(gb).toEqual({ amount: '160.00', currencyCode: 'GBP' });
  });

  it('creates one order per idempotency key, however often it is retried', async () => {
    const c = new MockCommerceProvider();
    const lines = [{ productId: 'p03', variantId: 'p03:M', size: 'M', quantity: 1 }];
    const before = (await c.listOrders()).length;
    const first = await c.startCheckout(lines, 'ZA', 'k1', 'confirmed');
    const again = await c.startCheckout(lines, 'ZA', 'k1', 'confirmed');
    expect(again).toEqual(first);
    expect((await c.listOrders()).length).toBe(before + 1);
  });

  it('resolves a pending payment to one order on re-check', async () => {
    const c = new MockCommerceProvider();
    const lines = [{ productId: 'p03', variantId: 'p03:M', size: 'M', quantity: 1 }];
    const before = (await c.listOrders()).length;
    expect((await c.startCheckout(lines, 'ZA', 'k2', 'pending')).outcome).toBe('pending');
    expect((await c.listOrders()).length).toBe(before);
    const settled = await c.startCheckout(lines, 'ZA', 'k2');
    expect(settled.outcome).toBe('confirmed');
    await c.startCheckout(lines, 'ZA', 'k2');
    expect((await c.listOrders()).length).toBe(before + 1);
  });

  it('flags a line that is no longer available when the cart is re-checked', async () => {
    const result = await commerce.revalidateCart(
      [{ productId: 'p12', variantId: 'p12:One size', size: 'One size', quantity: 1 }],
      'ZA',
    );
    expect(result.problems).toEqual([expect.objectContaining({ kind: 'unavailable' })]);
  });
});

describe('MockDeliveryProvider', () => {
  it('starts a new order at "order confirmed" and advances one confirmed stage at a time', async () => {
    const d = new MockDeliveryProvider(0);
    const t0 = (await d.getTracking('DEMO-ORDER-0009'))!;
    expect(stageIndex(t0)).toBe(0);
    d.advance('DEMO-ORDER-0009');
    d.advance('DEMO-ORDER-0009');
    d.advance('DEMO-ORDER-0009');
    const t3 = (await d.getTracking('DEMO-ORDER-0009'))!;
    expect(stageIndex(t3)).toBe(3);
    expect(t3.events.at(-1)?.source).toBe('carrier');
    expect(t3.trackingReference).toBe('SAMPLE-TRK-0001');
  });

  it('acknowledges a preference change only after the courier accepts it, and refuses past cut-off', async () => {
    const d = new MockDeliveryProvider(0);
    const ack = await d.requestPreference('DEMO-ORDER-0008', { place: 'reception' });
    expect(ack.acknowledgedAt).toBeDefined();
    for (let i = 0; i < 5; i++) d.advance('DEMO-ORDER-0008');
    await expect(d.requestPreference('DEMO-ORDER-0008', { place: 'door' })).rejects.toThrow(
      /on the way/,
    );
  });

  it('pushes updates to subscribers and clears its timers when they leave', async () => {
    jest.useFakeTimers();
    const d = new MockDeliveryProvider(0);
    const seen: number[] = [];
    const stop = d.subscribe('DEMO-ORDER-0007', (t) => seen.push(stageIndex(t)));
    for (let i = 0; i < 5; i++) d.advance('DEMO-ORDER-0007');
    d.setMode('DEMO-ORDER-0007', 'local');
    const t = (await d.getTracking('DEMO-ORDER-0007'))!;
    expect(trackingView(t, (s) => s).map.show).toBe(true);
    jest.advanceTimersByTime(4000);
    expect(seen.length).toBeGreaterThan(5);
    stop();
    jest.useRealTimers();
  });
});

describe('MockBookingProvider', () => {
  it('never double-books: same key returns the same request; a held slot cannot be requested again', async () => {
    const b = new MockBookingProvider();
    const from = new Date(2026, 9, 11);
    const slot = (await b.listSlots('styling', from, 14)).find((s) => s.available)!;
    const req = { typeId: 'styling', slotId: slot.id, name: 'Sample', email: 'sample@example.com' };
    const a1 = await b.requestAppointment(req, 'key-a');
    const a2 = await b.requestAppointment(req, 'key-a');
    expect(a2).toEqual(a1);
    expect(a1.status).toBe('requested');
    await expect(b.requestAppointment(req, 'key-b')).rejects.toThrow(/taken/);
    const after = (await b.listSlots('styling', from, 14)).find((s) => s.id === slot.id)!;
    expect(after.available).toBe(false);
  });

  it('closes Sundays', async () => {
    const b = new MockBookingProvider();
    const slots = await b.listSlots('studio', new Date(2026, 9, 11), 14);
    const sunday = slots.filter((s) => new Date(s.startsAt).getUTCDay() === 0);
    expect(sunday.length).toBeGreaterThan(0);
    expect(sunday.every((s) => !s.available)).toBe(true);
  });
});

describe('asset registry', () => {
  it('holds exactly the 24 verified concept images, each described', () => {
    expect(ASSET_IDS).toHaveLength(24);
    for (const id of ASSET_IDS) {
      expect(assetRegistry[id].conceptAsset).toBe(true);
      expect(assetRegistry[id].alt.length).toBeGreaterThan(20);
    }
    expect(
      catalogue.products
        .flatMap((p) => p.media)
        .every((m) => (ASSET_IDS as readonly string[]).includes(m)),
    ).toBe(true);
  });
});
