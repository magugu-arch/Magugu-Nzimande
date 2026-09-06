import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fetchOrders } from '@/services/orderService';
import { fetchMenu } from '@/services/menuService';
import { describeReorder, planReorder } from '@/features/orders/reorder';
import { isSoldOut, orderableFirst } from '@/features/menu/availability';

const code = (file: string) =>
  readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const orderNamed = async (reference: string) => {
  const order = (await fetchOrders()).find((candidate) => candidate.reference === reference);
  if (!order) throw new Error(`${reference} is not seeded`);
  return order;
};

/**
 * 1 — "Order again" putting back a dish the kitchen cannot make.
 *
 * `planReorder` asked `!product.available`, which is the narrower of the two
 * questions. The rest of the app moved to `isSoldOut` a while ago — the menu
 * list, the product screen, the offers screen and the rewards catalogue all use
 * it — and reorder was the last caller reading the flag directly.
 */
describe('reordering a dish whose required group has emptied', () => {
  it('has a seeded order that contains one', async () => {
    const [order, menu] = await Promise.all([orderNamed('BBQ-4821'), fetchMenu()]);
    const line = order.lines.find((candidate) => candidate.productId === 'cheesling-fries');
    const product = menu.products.find((candidate) => candidate.id === 'cheesling-fries');

    expect(order.status).toBe('completed');
    expect(line).toBeDefined();
    // On the menu, and unorderable — which is the pair that made this invisible.
    expect(product?.available).toBe(true);
    expect(isSoldOut(product!)).toBe(true);
  });

  /**
   * The defect. `product.available` is true, so the line went back into the
   * basket and nothing was said — and `reconcileCart`, which does re-resolve
   * every chosen option, then dropped it on the cart screen. The customer was
   * told "Added what we could" and opened a basket that quietly differed from
   * it, by exactly the item the dialogue exists to name.
   */
  it('is left out, and named', async () => {
    const [order, menu] = await Promise.all([orderNamed('BBQ-4821'), fetchMenu()]);
    const plan = planReorder(order.lines, menu.products);

    expect(plan.unavailable).toContain('Cheesling Fries');
    expect(plan.addable.some(({ product }) => product.id === 'cheesling-fries')).toBe(false);
    expect(describeReorder(plan)?.message).toMatch(/Cheesling Fries is no longer available/);
  });

  /** Seen in Chromium: "Added what we could · Cheesling Fries is no longer available". */
  it('still brings back everything else on the order', async () => {
    const [order, menu] = await Promise.all([orderNamed('BBQ-4821'), fetchMenu()]);
    const plan = planReorder(order.lines, menu.products);

    expect(plan.addable.length).toBe(order.lines.length - 1);
    expect(describeReorder(plan)?.title).toBe('Added what we could');
  });

  it('asks the same question the rest of the app asks', () => {
    const source = code('src/features/orders/reorder.ts');

    expect(source).toMatch(/if \(!product \|\| isSoldOut\(product\)\)/);
    expect(source).not.toMatch(/!product\.available/);
  });

  /** The control: an order with nothing left at all still says so. */
  it('says nothing came back when nothing can', async () => {
    const [order, menu] = await Promise.all([orderNamed('BBQ-4838'), fetchMenu()]);
    const plan = planReorder(order.lines, menu.products);

    expect(plan.addable).toHaveLength(0);
    expect(describeReorder(plan)?.title).toBe('Nothing to reorder');
  });
});

/**
 * 2 — the merchandising rows on Home, ranked by what can be bought.
 *
 * `orderableFirst` was written for the "Goes well with" carousel and applied
 * only there, which left the same rule unapplied on the busiest screen in the
 * app. This is a guard more than a visible change on today's data — the two
 * dishes that cannot be ordered already sit late in the catalogue — but the
 * catalogue is server data, and a reorder of it or a second dish selling out
 * would put an unbuyable card at the head of a row without this.
 */
describe('the Home rows', () => {
  it('rank what can be bought ahead of what cannot', async () => {
    const menu = await fetchMenu();
    const withOneSoldOut = [
      menu.products.find((p) => p.id === 'cheesling-fries')!,
      menu.products.find((p) => p.id === 'golden-original')!,
    ];

    expect(orderableFirst(withOneSoldOut).map((p) => p.id)).toEqual([
      'golden-original',
      'cheesling-fries',
    ]);
  });

  it('is what the screen actually renders from', () => {
    const screen = code('src/app/(tabs)/home.tsx');

    expect(screen).toMatch(/orderableFirst\(popular\.data \?\? \[\]\)/);
    expect(screen).toMatch(/orderableFirst\(bestSellers\.data \?\? \[\]\)/);
    expect(screen).toMatch(/\{popularRanked\.map\(/);
    expect(screen).toMatch(/\{bestSellersRanked\.map\(/);
  });

  /**
   * Favourites are deliberately left alone. The row is the customer's own list
   * in the order they hearted things, and re-sorting somebody's own shortlist
   * by today's stock is a different decision from re-sorting a row the shop
   * chose for them. The card still says "Sold out".
   */
  it('leaves the customer’s own favourites in the customer’s own order', () => {
    const screen = code('src/app/(tabs)/home.tsx');
    const block = screen.slice(screen.indexOf('const favourites = useMemo'));

    expect(block.slice(0, 400)).not.toMatch(/orderableFirst/);
  });
});

/**
 * 3 — a tap on Place order that the app refuses.
 *
 * Found by a security review of the branch, reported as a functional note
 * rather than a vulnerability, which is what it is — and it is the worse of the
 * two things that review turned up for a customer.
 *
 * `inFlight` is raised at the top of the handler and lowered in the `finally`
 * of the submit block. The fulfilment re-check returns *before* that block, so
 * nothing lowered it: one blocked tap left the ref true for the life of the
 * screen and every later tap returned at the guard, silently.
 */
describe('a blocked tap on Place order', () => {
  it('releases the in-flight guard before returning', () => {
    const screen = code('src/app/checkout/index.tsx');
    const guarded = screen.slice(screen.indexOf('if (stillBlocked) {'));

    expect(guarded.slice(0, 200)).toMatch(/inFlight\.current = false;/);
  });

  /**
   * The ordering matters: released, then the failure is set. Setting the
   * failure first would work today and would be one refactor away from not.
   */
  it('does so before reporting the failure', () => {
    const screen = code('src/app/checkout/index.tsx');
    const block = screen.slice(screen.indexOf('if (stillBlocked) {'));
    const release = block.indexOf('inFlight.current = false');
    const report = block.indexOf('setFailure(');

    expect(release).toBeGreaterThan(-1);
    expect(release).toBeLessThan(report);
  });

  it('leaves the guard itself in place, which is the thing protecting the money', () => {
    const screen = code('src/app/checkout/index.tsx');

    expect(screen).toMatch(/if \(inFlight\.current\) return;/);
    expect(screen).toMatch(/inFlight\.current = true;/);
  });
});

/**
 * 4 — a request path that climbs out of the directory being served.
 *
 * The one finding from the security review that was a vulnerability, and it was
 * in a script written on this branch last round. Node's http server does not
 * normalise `req.url`, so `..` survived a bare `path.join`, and
 * `decodeURIComponent` turned `%2e%2e` into `..` before the join.
 */
describe('the audit servers', () => {
  /** The invariant, stated the way the fixed script states it. */
  const contained = (raw: string, out: string): string => {
    const pathname = decodeURIComponent(new URL(raw, 'http://x').pathname);
    let file = path.resolve(out, '.' + pathname);
    if (file !== out && !file.startsWith(out + path.sep)) file = path.join(out, 'index.html');
    return file;
  };

  it('cannot be walked out of with dot segments', () => {
    const out = '/tmp/served';

    expect(contained('/../../../../etc/hosts', out).startsWith(out + path.sep)).toBe(true);
    expect(contained('/%2e%2e/%2e%2e/etc/hosts', out).startsWith(out + path.sep)).toBe(true);
    expect(contained('/../../root/.ssh/id_rsa', out).startsWith(out + path.sep)).toBe(true);
  });

  it('still serves what it is meant to serve', () => {
    const out = '/tmp/served';

    expect(contained('/_expo/static/js/web/app.js', out)).toBe(`${out}/_expo/static/js/web/app.js`);
    expect(contained('/', out)).toBe(out);
  });

  it('is what the script now does, through both guards', () => {
    const script = code('scripts/audit-text-scale.mjs');

    // The parser folds the dot segments…
    expect(script).toMatch(/new URL\(req\.url \?\? '\/', 'http:\/\/x'\)\.pathname/);
    // …and the prefix check states the invariant rather than trusting it.
    expect(script).toMatch(/!file\.startsWith\(OUT \+ path\.sep\)/);
  });

  /**
   * And none of them should be reachable from the network the machine happens
   * to be on. They exist for the length of one sweep.
   */
  it('bind to loopback, every one of them', () => {
    const scripts = [
      'audit-coldstart',
      'audit-delivery-range',
      'audit-guest',
      'audit-handover',
      'audit-offline',
      'audit-points',
      'audit-returning',
      'audit-screens',
      'audit-text-scale',
      'audit-tracking',
      'preview-shots',
      'smoke-order',
    ];

    for (const name of scripts) {
      const source = readFileSync(path.join(__dirname, '..', 'scripts', `${name}.mjs`), 'utf8');
      const listens = source.match(/\.listen\([^)]*\)/g) ?? [];

      expect(listens.length).toBeGreaterThan(0);
      for (const listen of listens) {
        expect({ name, listen }).toEqual({ name, listen: expect.stringContaining("'127.0.0.1'") });
      }
    }
  });
});
