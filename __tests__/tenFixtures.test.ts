import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Order } from '@/types';
import { fetchOrders, fetchOrder } from '@/services/orderService';
import { savedAddresses, notifications } from '@/services/data/accountData';
import { vouchers, rewards } from '@/services/data/rewardsData';
import { isEmailVerified, requestEmailVerification } from '@/services/authService';
import { errorCode, isNotFound } from '@/services/apiClient';
import { stores } from '@/services/data/storeData';
import { distanceKm } from '@/utils/geo';
import { runningLate } from '@/features/orders/liveStatus';
import { useAuthStore } from '@/store/authStore';

const code = (file: string) =>
  readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const orderNamed = async (reference: string): Promise<Order> => {
  const orders = await fetchOrders();
  const order = orders.find((candidate) => candidate.reference === reference);
  if (!order) throw new Error(`${reference} is not seeded`);
  return order;
};

/**
 * 1 — a verified email, which the app had no path to.
 *
 * `register` creates every customer unverified and the seeded one is
 * unverified too, deliberately. But the mock's verification only ever returned
 * `{ sentTo }`, so `emailVerified` could never become true in a demo build:
 * the success badge, and the profile screen without its warning, were
 * unreachable by construction.
 */
describe('an email that can actually be verified', () => {
  it('is unverified to begin with, which is the ordinary state', () => {
    expect(isEmailVerified('someone-new@example.co.za')).toBe(false);
  });

  it('is verified once the mock has followed the link', async () => {
    await requestEmailVerification('thandi@example.co.za');

    expect(isEmailVerified('thandi@example.co.za')).toBe(true);
    expect(isEmailVerified('THANDI@example.co.za ')).toBe(true);
  });

  it('the profile screen reads the answer back', () => {
    const screen = code('src/app/account/profile.tsx');

    expect(screen).toMatch(/isEmailVerified\(user\.email\)/);
    expect(screen).toMatch(/setUser\(\{ \.\.\.user, emailVerified: true \}\)/);
  });
});

/**
 * 2 — a courier the network is authorised to track.
 *
 * `trackingAvailable` is false on every job the mock creates, deliberately, so
 * the authorised branch never ran either: `CourierTracking` draws a slot for
 * the map and prints when the position was last reported.
 */
describe('a courier reporting a live position', () => {
  it('is seeded, and is the only tracked job', async () => {
    const orders = await fetchOrders();
    const tracked = orders.filter((order) => order.delivery?.trackingAvailable);

    expect(tracked.map((order) => order.reference)).toEqual(['BBQ-4854']);
    expect(tracked[0]?.delivery?.courierPosition).toBeDefined();
  });

  it('reports a position on the road, not a coordinate at nought', async () => {
    const order = await orderNamed('BBQ-4854');
    const position = order.delivery?.courierPosition;
    const store = stores.find((candidate) => candidate.id === order.storeId);

    expect(position?.latitude).toBeLessThan(0);
    expect(
      distanceKm(
        { latitude: position!.latitude, longitude: position!.longitude },
        { latitude: store!.latitude, longitude: store!.longitude },
      ),
    ).toBeLessThan(10);
  });

  /** Still no map. Drawing a fake one would be worse than none. */
  it('draws the slot that receives a map rather than a map', () => {
    const card = code('src/features/orders/components/CourierTracking.tsx');

    expect(card).toMatch(/job\.trackingAvailable && job\.courierPosition \?/);
    expect(card).toMatch(/Live position reported/);
  });
});

/**
 * 3 — a job that says why it ended.
 *
 * `reason` was on the quote and nowhere on the job, so a delivery that came
 * back FAILED could not carry the one fact the customer wants.
 */
describe('a delivery that says why it failed', () => {
  it('carries the reason on the job', async () => {
    const order = await orderNamed('BBQ-4840');

    expect(order.delivery?.status).toBe('FAILED');
    expect(order.delivery?.reason).toMatch(/Nobody answered at the gate/);
  });

  it('prints the provider words rather than the generic sentence', () => {
    expect(code('src/features/orders/components/CourierTracking.tsx')).toMatch(
      /job\.reason\s*\?\s*job\.reason/,
    );
  });
});

/**
 * 4 and 5 — a customer who has actually changed something.
 *
 * Every account carried the defaults, so four settings had only ever been
 * rendered in one position: `preferMildFirst` reorders the whole menu,
 * `defaultFulfilment` decides what the app opens on, and `channelSms` and
 * `marketingConsent` are consent records rather than conveniences.
 */
describe('preferences that are not the defaults', () => {
  it('is seeded on a demo build only', () => {
    const store = code('src/store/authStore.ts');

    expect(store).toMatch(/config\.useMockApi \? SEEDED_PREFERENCES : DEFAULT_PREFERENCES/);
    expect(store).toMatch(/config\.useMockApi \? SEEDED_NOTIFICATIONS : DEFAULT_NOTIFICATIONS/);
  });

  it('turns on every switch that had only ever been off', () => {
    const state = useAuthStore.getState();

    expect(state.preferences.preferMildFirst).toBe(true);
    expect(state.preferences.marketingConsent).toBe(true);
    expect(state.preferences.defaultFulfilment).toBe('collection');
    expect(state.notificationPreferences.channelSms).toBe(true);
    expect(state.notificationPreferences.newProducts).toBe(true);
  });
});

/**
 * 6 — an address every branch is too far from.
 *
 * The only address that had exercised anything near `deliveryRange` was Mum's
 * place, which has no coordinates at all — so the rule lets it through rather
 * than refusing on a measurement nobody took. The refusal itself had never run.
 */
describe('an address no branch can reach', () => {
  it('is seeded, located, and far from everything', () => {
    const gran = savedAddresses.find((address) => address.id === 'address-gran');

    expect(gran?.latitude).toBeDefined();
    const nearest = Math.min(
      ...stores.map((store) =>
        distanceKm(
          { latitude: gran!.latitude!, longitude: gran!.longitude! },
          { latitude: store.latitude, longitude: store.longitude },
        ),
      ),
    );

    expect(nearest).toBeGreaterThan(Math.max(...stores.map((s) => s.deliveryRadiusKm)));
    expect(nearest).toBeGreaterThan(300);
  });

  it('leaves the unlocated address as the other case it was written for', () => {
    const mum = savedAddresses.find((address) => address.id === 'address-mum');

    expect(mum?.latitude).toBeUndefined();
  });
});

/** 7 — a code with nothing to qualify for. */
describe('a voucher with no minimum spend', () => {
  it('is seeded, and is the only one', () => {
    const free = vouchers.filter((voucher) => voucher.minimumSpend === 0);

    expect(free.map((voucher) => voucher.code)).toEqual(['SORRY20']);
  });

  it('is guarded out of the wallet sentence rather than printing R 0.00', () => {
    expect(code('src/app/rewards/vouchers.tsx')).toMatch(/voucher\.minimumSpend > 0 && !spent/);
  });
});

/**
 * 8 — a booking the kitchen has missed.
 *
 * The one shape where "overdue" and "nothing has happened yet" are both true.
 * The tracking hero tested `scheduledFor` first and stopped there, so a slot
 * forty minutes gone still read only "Scheduled for …".
 */
describe('a booking whose slot has passed', () => {
  it('is seeded, still at received, and due in the past', async () => {
    const order = await orderNamed('BBQ-4856');

    expect(order.status).toBe('received');
    expect(new Date(order.scheduledFor!).getTime()).toBeLessThan(Date.now());
  });

  it('is late as well as scheduled', async () => {
    expect(runningLate(await orderNamed('BBQ-4856'))).toBe(true);
  });

  it.each(['src/app/order/[id]/index.tsx', 'src/app/(tabs)/orders.tsx'])(
    '%s says both, rather than only the slot',
    (file) => {
      const screen = code(file);
      const scheduled = screen.slice(screen.indexOf('scheduledFor'));

      expect(scheduled.slice(0, 600)).toMatch(/runningLate\(/);
    },
  );

  /** A booking still ahead of its slot must not be called late. */
  it("leaves tomorrow's booking alone", async () => {
    expect(runningLate(await orderNamed('BBQ-4850'))).toBe(false);
  });
});

/**
 * 9 — a push about an order that is no longer there.
 *
 * A lock screen keeps a notification for weeks and a ledger does not keep
 * everything for ever, so following an old one is the ordinary way somebody
 * reaches a missing order. Nothing had ever asked the screen for one.
 */
describe('a notification pointing at an order that is gone', () => {
  it('is seeded with an href nothing resolves', () => {
    const dead = notifications.find((entry) => entry.id === 'notif-7');

    expect(dead?.href).toBe('/order/order-3980');
  });

  /**
   * The defect: a generic Error reached the screen as `isError`, which draws
   * "Something went wrong · Check your connection and try again" over a Try
   * again button that can never work. An empty state is a claim about the
   * world; an error state is a claim about the app.
   */
  it('fails as a 404 rather than as a broken request', async () => {
    let thrown: unknown = null;
    try {
      await fetchOrder('order-3980');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).not.toBeNull();
    expect(isNotFound(thrown) || errorCode(thrown) === 'order_not_found').toBe(true);
  });

  it('says the order is not there rather than blaming the connection', () => {
    const screen = code('src/app/order/[id]/index.tsx');

    expect(screen).toMatch(/errorCode\(order\.error\) === 'order_not_found'/);
    expect(screen).toMatch(/We can't find that order/);
  });
});

/** 10 — a reward that runs out tomorrow. */
describe('a reward expiring within the day', () => {
  it('is seeded close enough to matter', () => {
    const soon = rewards.filter((reward) => {
      if (!reward.expiresAt) return false;
      const hours = (new Date(reward.expiresAt).getTime() - Date.now()) / 3_600_000;
      return hours > 0 && hours < 48;
    });

    expect(soon.length).toBeGreaterThan(0);
  });

  /**
   * Two dated rewards, one either side of now. The far-future case lives on
   * the vouchers, which carry expiries from a week to two months out — the
   * rewards were only ever "10 days away" and "6 days gone", so moving the
   * first to 20 hours is what puts the near case on a screen without losing
   * the expired one.
   */
  it('still leaves one already gone', () => {
    const days = rewards
      .filter((reward) => reward.expiresAt)
      .map((reward) => (new Date(reward.expiresAt!).getTime() - Date.now()) / 86_400_000);

    expect(days).toHaveLength(2);
    expect(days.some((d) => d < 0)).toBe(true);
    expect(
      vouchers.some((v) => (new Date(v.expiresAt).getTime() - Date.now()) / 86_400_000 > 7),
    ).toBe(true);
  });
});
