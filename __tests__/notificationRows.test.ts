import { readFileSync } from 'node:fs';
import path from 'node:path';
import { notifications } from '@/services/data/accountData';
import { fetchOrder } from '@/services/orderService';
import { inAppRoute } from '@/utils/linking';

/**
 * A notification with nowhere to go.
 *
 * `AppNotification.category` has four members — order, promotion, reward,
 * system — and only three were ever seeded. `href` is optional and every
 * seeded notification carried one. So the row that has no destination had
 * never rendered anywhere: not in the app, not in the browser sweep, not in a
 * test.
 *
 * Every row is drawn as a pressable `Card`. For the three categories that
 * always had an href that is right. For the fourth it produced a card drawn as
 * a button, announced to a screen reader as a button, that did nothing at all
 * when a customer tapped it.
 *
 * A service advisory is the ordinary case: load-shedding delaying a kitchen is
 * not a screen anybody can be sent to, it is a thing to be told.
 */
const screen = readFileSync(
  path.join(__dirname, '..', 'src/app/account/notifications.tsx'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('the notification seed', () => {
  it('covers every category the type declares', () => {
    const seeded = new Set(notifications.map((entry) => entry.category));

    expect([...seeded].sort()).toEqual(['order', 'promotion', 'reward', 'system']);
  });

  it('has one with no href, which is what the row had never been given', () => {
    const hrefless = notifications.filter((entry) => !entry.href);

    expect(hrefless.length).toBeGreaterThan(0);
    expect(hrefless[0]!.category).toBe('system');
  });

  it('routes every href it does carry to somewhere in the app', () => {
    for (const entry of notifications) {
      if (!entry.href) continue;
      // `inAppRoute` hands back the fallback for anything it will not follow,
      // so a seeded href that cannot survive it is a dead link in the seed.
      expect(inAppRoute(entry.href, '/fallback')).toBe(entry.href);
    }
  });
});

/**
 * And the order notification tells the truth.
 *
 * It named BBQ-4821 — completed three days ago — and said it was on the way,
 * received forty minutes ago. Two false statements on a screen a customer
 * reads, produced by a seed written before there was a live order to point at.
 */
describe('the order notification', () => {
  it('names an order that is actually on its way', async () => {
    const entry = notifications.find((n) => n.category === 'order')!;
    const reference = /BBQ-\d+/.exec(entry.body)?.[0];

    expect(reference).toBe('BBQ-4830');

    const order = await fetchOrder('order-4830');
    expect(order.status).toBe('out_for_delivery');
  });

  it('links to that order rather than to the list', () => {
    const entry = notifications.find((n) => n.category === 'order')!;

    expect(entry.href).toBe('/order/order-4830');
  });
});

describe('what the row does with it', () => {
  it('is pressable only when a tap would change something', () => {
    expect(screen).toMatch(
      /canOpen\(notification\) \? \(\) => handleOpen\(notification\) : undefined/,
    );
  });

  it('counts an unread mark as something, not only a destination', () => {
    expect(screen).toMatch(/Boolean\(notification\.href\) \|\| !notification\.read/);
  });

  it('no longer hands every row an onPress unconditionally', () => {
    // The shape of the defect.
    expect(screen).not.toMatch(/onPress=\{\(\) => handleOpen\(notification\)\}/);
  });
});
