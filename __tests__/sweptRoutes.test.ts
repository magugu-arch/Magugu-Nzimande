import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const audit = () => code('scripts/audit-offline.mjs');

/** The routes `audit:offline` actually visits, read off the script. */
function sweptRoutes(): string[] {
  const source = audit();
  const list = source.slice(
    source.indexOf('const ROUTES = ['),
    source.indexOf('const NEEDS_BASKET'),
  );
  return [...list.matchAll(/'(\/[^']*)'/g)].map((match) => match[1]!);
}

/**
 * Screens that answer a paused query honestly, found by the thing they all
 * have in common rather than by a list somebody keeps up to date.
 */
function screensWithAnOfflineBranch(): string[] {
  const routes = [
    ['/menu', 'src/app/(tabs)/menu.tsx'],
    ['/rewards', 'src/app/(tabs)/rewards.tsx'],
    ['/orders', 'src/app/(tabs)/orders.tsx'],
    ['/offers', 'src/app/offers/index.tsx'],
    ['/offers/promo-free-delivery', 'src/app/offers/[id].tsx'],
    ['/rewards/vouchers', 'src/app/rewards/vouchers.tsx'],
    ['/account/payment-methods', 'src/app/account/payment-methods.tsx'],
    ['/account/notifications', 'src/app/account/notifications.tsx'],
    ['/order/order-4821', 'src/app/order/[id]/index.tsx'],
    ['/checkout/store', 'src/app/checkout/store.tsx'],
    ['/product/golden-original', 'src/app/product/[id].tsx'],
    ['/home', 'src/app/(tabs)/home.tsx'],
    ['/account/help', 'src/app/account/help.tsx'],
    ['/rewards/reward-birthday', 'src/app/rewards/[id].tsx'],
    ['/order/order-4610/rate', 'src/app/order/[id]/rate.tsx'],
  ] as const;

  return routes.filter(([, file]) => /isOfflinePending/.test(code(file))).map(([route]) => route);
}

/**
 * 1 — the pattern, stated once so it cannot be forgotten.
 *
 * `isOfflinePending` has existed for a long time and twelve screens used it.
 * Which twelve? Exactly the twelve `audit:offline` visited. Every screen the
 * sweep never reached still had the hole `queryPhase.ts` was written about:
 * loading, then error, then `data ?? []`, and a paused query falling past all
 * three.
 *
 * The fix followed the sweep. That is not a coincidence and it is not a
 * criticism of whoever wrote the fix — it is the shape of how defects get
 * found here, and the lesson is about the route list rather than the code.
 */
describe('the screens the sweep never visited', () => {
  it('now visits every screen that has an offline branch', () => {
    const swept = new Set(sweptRoutes());

    for (const route of screensWithAnOfflineBranch()) {
      expect(swept.has(route)).toBe(true);
    }
  });

  it('grew by the four it had been missing', () => {
    const swept = sweptRoutes();

    expect(swept).toContain('/home');
    expect(swept).toContain('/account/help');
    expect(swept).toContain('/rewards/reward-birthday');
    expect(swept).toContain('/order/order-4610/rate');
  });

  it('did not lose any it already had', () => {
    const swept = sweptRoutes();

    for (const route of [
      '/menu',
      '/offers',
      '/orders',
      '/rewards',
      '/rewards/vouchers',
      '/account/payment-methods',
      '/account/notifications',
      '/checkout/store',
      '/product/golden-original',
      '/order/order-4821',
      '/offers/promo-free-delivery',
      '/checkout',
    ]) {
      expect(swept).toContain(route);
    }
  });
});

/**
 * 2 — the front door.
 *
 * Home is the busiest screen in the app and it drew itself in full and empty:
 * "Popular right now · What everyone else is ordering · See all" over an empty
 * row, Best sellers the same, no categories, and not one word about the
 * server. A menu with nothing on it, presented as the menu.
 */
describe('home, against a server it cannot reach', () => {
  const home = code('src/app/(tabs)/home.tsx');

  it('answers the paused query rather than falling past it', () => {
    expect(home).toMatch(/isOfflinePending/);
    expect(home).toMatch(/<OfflineState onRetry=\{handleRefresh\} \/>/);
  });

  /**
   * 3 — from the same queries as the branches it sits between, so this is a
   * third answer to one question rather than a fourth question. Adding it
   * cannot change what loading or error already do.
   */
  it('asks about the same four queries the other two branches use', () => {
    expect(home).toMatch(
      /const isOffline = \[categories, popular, promotions, bestSellers\]\.some\(isOfflinePending\)/,
    );
    expect(home).toMatch(
      /categories\.isLoading \|\| popular\.isLoading \|\| promotions\.isLoading \|\| bestSellers\.isLoading/,
    );
  });

  it('sits between loading and error, in that order', () => {
    const loading = home.indexOf('if (isLoading)');
    const offline = home.indexOf('if (isOffline)');
    const error = home.indexOf('if (isError)');

    expect(loading).toBeLessThan(offline);
    expect(offline).toBeLessThan(error);
  });

  /**
   * 4 — and the thing that was already right, which is worth recording so
   * nobody "fixes" it. `openingStatus` refuses to call an empty list a closed
   * business; the banner that would have said "we open soon" to everyone on a
   * network blip never appeared, because that function was written carefully.
   */
  it('never turned an empty store list into a closed business', () => {
    const opening = code('src/features/stores/opening.ts');

    expect(opening).toMatch(/if \(stores\.length === 0\) return \{ anyTrading: true/);
  });
});

/**
 * 5 — the help centre with no help in it.
 */
describe('the help centre', () => {
  const help = code('src/app/account/help.tsx');

  it('says it could not load, rather than offering to escalate', () => {
    expect(help).toMatch(/isOfflinePending\(topics\)/);
    expect(help).toMatch(/<OfflineState onRetry=\{\(\) => void topics\.refetch\(\)\} \/>/);
  });

  it('keeps its error branch for the case that really is an error', () => {
    expect(help).toMatch(/if \(topics\.isError\)/);
    expect(help).toMatch(/<ErrorState onRetry=/);
  });

  it('is checked by the sweep for the footer that gave it away', () => {
    expect(audit()).toMatch(/offers to escalate under a help list that never loaded/);
  });
});

/**
 * 6 — a reward that had not expired.
 *
 * "We can't find that reward. It may have expired." is the right sentence for
 * a reward that really has lapsed, and a lie told to somebody in a lift who
 * tapped a reward they were looking at a minute ago. The same defect
 * `/offers/[id]` was fixed for — "That offer has ended" — one screen over, and
 * it survived because the sweep visits an offer and had never visited a
 * reward.
 */
describe('the reward detail', () => {
  const reward = code('src/app/rewards/[id].tsx');

  it('checks the connection before it blames the catalogue', () => {
    const offline = reward.indexOf('isOfflinePending(reward)');
    const claim = reward.indexOf("We can't find that reward");

    expect(offline).toBeGreaterThan(-1);
    expect(offline).toBeLessThan(claim);
  });

  it('asks about the loyalty account too, which the error branch also reads', () => {
    expect(reward).toMatch(/isOfflinePending\(reward\) \|\| isOfflinePending\(loyalty\)/);
    expect(reward).toMatch(/reward\.isError \|\| !reward\.data \|\| !loyalty\.data/);
  });

  /** 7 — and keeps the sentence for the reward that genuinely lapsed. */
  it('still says it for a reward that really has expired', () => {
    expect(reward).toMatch(/It may have expired/);
    expect(reward).toMatch(/rewardExpired\(data, now\)/);
  });

  it('is scoped in the sweep, because that sentence is sometimes true', () => {
    expect(audit()).toMatch(
      /'blames the rewards catalogue for a failed fetch',\s*'\/rewards\/reward-birthday'/,
    );
  });
});

/**
 * 8 — the screen that blamed itself.
 *
 * "Something went wrong. We couldn't load this right now." is honest and worse
 * than it needs to be: it reads as a fault in the app, so the customer
 * restarts it and it happens again. Order tracking one route up already draws
 * the distinction, and this screen is reached from it.
 */
describe('rating an order with no signal', () => {
  const rate = code('src/app/order/[id]/rate.tsx');

  it('names the connection instead of apologising for itself', () => {
    expect(rate).toMatch(/isOfflinePending\(order\)/);
    expect(rate).toMatch(/<OfflineState onRetry=\{\(\) => void order\.refetch\(\)\} \/>/);
  });

  it('checks it before the generic error, not after', () => {
    expect(rate.indexOf('isOfflinePending(order)')).toBeLessThan(
      rate.indexOf('order.isError || !order.data'),
    );
  });
});

/**
 * 9 — and the two screens that were already honest without being swept, so the
 * finding is reported as it was rather than tidier than it was.
 *
 * `/checkout/address` and `/checkout/schedule` were both visited by this
 * round's probe. The address picker was already correct — it says "You're
 * offline. We'll load this as soon as you're back on the network." — because
 * it was written alongside `/checkout/store`, which *is* swept. So the rule is
 * "the fix followed the sweep", not "only swept screens are correct".
 */
describe('what was already right', () => {
  it('the address picker answered honestly without ever being swept', () => {
    expect(code('src/app/checkout/address.tsx')).toMatch(/isOfflinePending\(addresses\)/);
  });

  /**
   * 10 — `/more` needed nothing at all. It is rows of navigation, and the one
   * figure it reads from a query is an unread badge that is simply absent when
   * there is nothing to count. An audit that demanded a message there would be
   * nagging.
   */
  it('the account menu claims nothing, so it is left alone', () => {
    const more = code('src/app/(tabs)/more.tsx');

    expect(more).not.toMatch(/isOfflinePending/);
    expect(more).toMatch(/const unreadCount = \(notifications\.data \?\? \[\]\)/);
    expect(sweptRoutes()).not.toContain('/more');
  });
});
