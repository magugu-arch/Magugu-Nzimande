import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fetchOrders, seedOrderLedger } from '@/services/orderService';
import { fetchLoyaltyAccount } from '@/services/rewardsService';
import { earnRateFor, tiers } from '@/services/data/rewardsData';
import { calculateTotals, priceBasket, reconcileCart } from '@/utils/cart';
import { fetchMenu } from '@/services/menuService';
import { useCartStore } from '@/store/cartStore';
import { describeReconciliation } from '@/features/cart/useCartReconciliation';
import type { CartLine } from '@/types';

const code = (file: string) =>
  readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * FIXTURE 1 — a basket saved before the menu moved.
 *
 * `reconcileCart` exists to bring one back into agreement, and the cart draws
 * a notice saying what it changed. Both were written for a state the seed
 * could not produce: the cart starts empty and nothing had ever put a stale
 * line in it.
 */
describe('a saved basket the menu has moved under', () => {
  it('is seeded on a demo build only', () => {
    const source = code('src/store/cartStore.ts');

    expect(source).toMatch(/lines: config\.useMockApi \? \[\.\.\.STALE_BASKET\] : \[\]/);
    expect(useCartStore.getState().lines.length).toBeGreaterThan(0);
  });

  /**
   * Two different reasons, which the notice has to distinguish: Rose
   * Ddeok-Bokki was withdrawn, and Cheesling Fries still stands but the last
   * option in its required Size group has gone.
   */
  it('is emptied by reconciliation, with both items named', async () => {
    const menu = await fetchMenu();
    const result = reconcileCart(useCartStore.getState().lines, menu.products);
    const notice = describeReconciliation(result);

    expect(result.lines).toHaveLength(0);
    expect(result.changed).toBe(true);
    expect(notice).toMatch(/Rose Ddeok-Bokki/);
    expect(notice).toMatch(/Cheesling Fries/);
  });

  /**
   * Emptied rather than reduced, deliberately: `audit:points` builds its own
   * basket and asserts the points on it, so it has to start where it started
   * before.
   */
  it('leaves nothing behind for the ordering audit to trip over', async () => {
    const menu = await fetchMenu();

    expect(reconcileCart(useCartStore.getState().lines, menu.products).lines).toEqual([]);
  });

  /**
   * The defect, seen in Chromium: reconciliation emptied the basket and the
   * empty-cart branch drew "Your cart is empty · Nothing in here yet" with no
   * word about the two items just removed. The notice lived only in the branch
   * that draws a list.
   */
  it('shows the notice on the empty screen too, and drops the word "yet"', () => {
    const screen = code('src/app/cart/index.tsx');
    const empty = screen.slice(screen.indexOf('cart-empty-screen'));

    expect(empty).toMatch(/reconciliation\.notice \?/);
    expect(empty).toMatch(/Nothing in here yet/);
    expect(empty).toMatch(/reconciliation\.notice\s*\?\s*'Have a look/);
  });
});

/**
 * FIXTURE 2 — an order rated with words.
 *
 * `ratingComment` is typed on the rating screen, stored by `rateOrder`,
 * carried on the wire — and was rendered by nothing. Two seeded orders have
 * carried one since the ledger was written.
 */
describe('what somebody wrote when they rated an order', () => {
  it('is on the seeded orders', async () => {
    const orders = await fetchOrders();
    const withWords = orders.filter((order) => order.ratingComment);

    expect(withWords.length).toBeGreaterThanOrEqual(2);
    expect(orders.find((order) => order.reference === 'BBQ-4610')?.ratingComment).toBe(
      'Crispy as always, collection was quick.',
    );
  });

  it('is shown back on the receipt, not only the stars', () => {
    expect(code('src/app/order/[id]/index.tsx')).toMatch(/data\.ratingComment \?/);
  });
});

/**
 * FIXTURE 3 — a ladder whose rungs actually differ.
 *
 * `randToPoints` has taken a per-tier rate since tiers were written — "the
 * tier's rate when one is known, the flat business rule otherwise" — and its
 * only caller never passed one. All four tiers carried `pointsPerRand: 1`, so
 * the tier rate and the flat rule agreed by coincidence and nothing could
 * notice.
 */
describe('an earn rate that follows the tier', () => {
  it('is seeded as a ladder that climbs', () => {
    const rates = tiers.map((tier) => tier.pointsPerRand);

    expect(new Set(rates).size).toBeGreaterThan(1);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
  });

  it('reads the rate off the ladder rather than keeping a copy', () => {
    expect(earnRateFor('bronze')).toBe(1);
    expect(earnRateFor('silver')).toBe(1.25);
    expect(earnRateFor('black')).toBe(2);
  });

  const line = (lineTotal: number): CartLine => ({
    id: 'x',
    productId: 'golden-original',
    name: 'Golden Original Chicken',
    assetKey: 'goldenOriginal',
    unitBasePrice: lineTotal,
    quantity: 1,
    selectedOptions: [],
    unitPrice: lineTotal,
    lineTotal,
  });

  /** The defect: a Silver member was quoted Bronze's rate on every basket. */
  it('pays the member their own rate', () => {
    const lines = [line(200)];

    expect(calculateTotals({ lines, fulfilmentType: 'collection' }).pointsEarned).toBe(200);
    expect(
      calculateTotals({ lines, fulfilmentType: 'collection', pointsPerRand: 1.25 }).pointsEarned,
    ).toBe(250);
    expect(
      priceBasket({ lines, fulfilmentType: 'collection', pointsPerRand: 2 }).totals.pointsEarned,
    ).toBe(400);
  });

  /** A guest has no tier, and quoting them nothing would be worse. */
  it('falls back to the flat rule when nobody is signed in', () => {
    expect(
      priceBasket({ lines: [line(200)], fulfilmentType: 'collection' }).totals.pointsEarned,
    ).toBe(200);
  });

  it('the cart passes the signed-in member rate', () => {
    const screen = code('src/app/cart/index.tsx');

    expect(screen).toMatch(/earnRateFor\(loyalty\.data\.tier\)/);
    expect(screen).toMatch(/pointsPerRand: earnRate/);
  });

  /** The rates are placeholders like every other loyalty number in the seed. */
  it('sends the rates to audit:launch rather than treating them as settled', () => {
    expect(code('scripts/audit-launch-readiness.mjs')).toMatch(
      /1 \/ 1\.25 \/ 1\.5 \/ 2 points per R1/,
    );
  });
});

/**
 * FIXTURE 4 — the points ledger, against the receipts it describes.
 *
 * Two history rows described orders and both lied about them: BBQ-4821 was
 * credited 231 points against a receipt reading 287, and BBQ-4610 was credited
 * 318 against 304. The receipt is in Orders and the ledger is in Rewards, so
 * nobody had put them side by side.
 */
describe('the points ledger and the receipts', () => {
  it('credits each order exactly what its receipt says', async () => {
    seedOrderLedger();
    const [orders, account] = await Promise.all([fetchOrders(), fetchLoyaltyAccount()]);
    const rows = account.history.filter((entry) => entry.orderReference);

    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      const order = orders.find((candidate) => candidate.reference === row.orderReference);
      expect(order).toBeDefined();
      expect(row.points).toBe(order?.totals.pointsEarned);
    }
  });

  it('writes the reference once, into the field, and builds the sentence from it', async () => {
    seedOrderLedger();
    const account = await fetchLoyaltyAccount();
    const row = account.history.find((entry) => entry.orderReference === 'BBQ-4821');

    expect(row?.description).toBe('Order BBQ-4821 · Honey Garlic Chicken');
    expect(row?.points).toBe(287);
  });

  /**
   * The rows are absent until the orders exist, so the Rewards tab has to be
   * the one that makes sure they do — `rewardsService` cannot import
   * `orderService` without a cycle. Opening Rewards first showed a ledger
   * missing the two entries that account for most of the balance.
   */
  it('is composed in the hook, where both services are reachable', () => {
    expect(code('src/features/rewards/hooks.ts')).toMatch(
      /if \(config\.useMockApi\) seedOrderLedger\(\);/,
    );
  });

  it('leaves the rows that are not about an order written where they are', async () => {
    const account = await fetchLoyaltyAccount();
    const standalone = account.history.filter((entry) => !entry.orderReference);

    expect(standalone.map((entry) => entry.description)).toEqual(
      expect.arrayContaining(['Redeemed · Free French Fries', 'Tier bonus · Silver unlocked']),
    );
  });
});
