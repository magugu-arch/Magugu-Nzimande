import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FOOD_ASSET_KEYS } from '@/constants/foodAssets';
import { notifications } from '@/services/data/accountData';
import { menuSnapshot } from '@/services/data/menuData';
import { formatPrice } from '@/utils/money';
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

/**
 * A notification with a photograph on it.
 *
 * Every push a quick-service chain sends looks the same: a title, a line of
 * copy, a price, and a picture of the food. `AppNotification` had no room for
 * the fourth — the row drew a category icon in a rounded square and nothing
 * else — so a promotion about chicken arrived looking exactly like a password
 * reset. Twenty-eight photographs in the catalogue, and the one screen most
 * like a real push notification used none of them.
 */
describe('the promotion push', () => {
  const push = () => notifications.find((entry) => entry.id === 'notif-6')!;

  it('carries artwork, which no notification could before', () => {
    expect(push().assetKey).toBeTruthy();
    expect(FOOD_ASSET_KEYS).toContain(push().assetKey);
  });

  it('is the only shape that does, so the row still has to draw both', () => {
    const withArt = notifications.filter((entry) => entry.assetKey);
    const without = notifications.filter((entry) => !entry.assetKey);

    expect(withArt.length).toBeGreaterThan(0);
    expect(without.length).toBeGreaterThan(0);
  });

  /**
   * The part worth being careful about. A notification saying "from R155"
   * with `155` typed into it is the drift `tierNudge` was written to stop, one
   * screen over: a wings price changes in `menuData` and the sentence goes on
   * advertising the old one to everybody's lock screen.
   */
  it('quotes a price that comes off the menu, not out of the copy', () => {
    const wings = menuSnapshot.products.filter((p) => p.categoryId === 'wings');
    const cheapest = Math.min(...wings.map((p) => p.basePrice));

    expect(push().body).toContain(formatPrice(cheapest));
    // And it is genuinely the cheapest, not just some wings price.
    for (const product of wings) {
      expect(product.basePrice).toBeGreaterThanOrEqual(cheapest);
    }
  });

  it('names flavours that are actually on the menu', () => {
    const names = menuSnapshot.products
      .filter((p) => p.categoryId === 'wings')
      .map((p) => p.name.replace(/ Wings$/, ''));

    for (const name of names) {
      expect(push().body).toContain(name);
    }
  });

  it('shows the artwork of the item whose price it quotes', () => {
    const wings = menuSnapshot.products.filter((p) => p.categoryId === 'wings');
    const cheapest = wings.reduce((low, p) => (p.basePrice < low.basePrice ? p : low), wings[0]!);

    expect(push().assetKey).toBe(cheapest.assetKey);
  });

  /**
   * The guard that actually holds the claim up.
   *
   * Asserting the body matches a price computed from the menu is half a test —
   * both halves read the same source. What stops the drift is that there is no
   * rand figure typed into the seed at all, so there is nothing to go stale.
   */
  it('has no price typed into the seed for it to go stale', () => {
    const seed = readFileSync(
      path.join(__dirname, '..', 'src/services/data/accountData.ts'),
      'utf8',
    );
    const push = seed.slice(
      seed.indexOf('function wingsPush'),
      seed.indexOf('export const notifications'),
    );

    expect(push).toMatch(/formatPrice\(/);
    // No `R155`, no `155`, no rand literal of any kind.
    expect(push).not.toMatch(/R\s?\d/);
    expect(push).not.toMatch(/\b\d{2,}\b/);
  });

  it('is drawn as a thumb, never a banner in a list', () => {
    expect(screen).toMatch(/assetKey=\{notification\.assetKey\}[\s\S]{0,80}variant="thumb"/);
    expect(screen).not.toMatch(/notification\.assetKey[\s\S]{0,120}variant="(banner|detail)"/);
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
