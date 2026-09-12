import { beforeEach, describe, expect, it } from 'vitest';
import { setSoldOut } from '@/lib/catalogue-state';
import {
  aProduct,
  blankState,
  bodyOf,
  clientCode,
  demoFunction,
  orderLine,
  orderRequest,
  placeOrder,
  request,
  required,
} from './fixtures';

/**
 * Ordering the same thing again, some time later.
 *
 * Both reorder buttons — the one on the journey and the one in the account's
 * order history — walked the past order's lines and put each one straight into
 * the basket: the name it had then, the options it had then, and the price it
 * cost then. Nothing asked the catalogue whether any of that was still true.
 *
 * The server does ask. `repriceLines` prices every line again and refuses a
 * basket whose numbers disagree, and its own comment says why in the customer's
 * case rather than the attacker's: "a basket built before a price changed, and
 * a customer in the second case is owed the news rather than a different amount
 * at the till."
 *
 * They were owed the news. What they got was one button, four screens of
 * checkout, and a 409 at the end naming slugs.
 *
 * Two of the three ways this happens are reachable on this deployment today,
 * from the console: an operator marks something sold out, or hides it. The
 * third arrives the day the franchisor replaces the [CONFIRM] prices, which is
 * every price in the catalogue at once — after which every past order in every
 * customer's browser is a basket that cannot be ordered.
 */

beforeEach(blankState);

describe('what a past order’s lines are worth now', () => {
  async function reprice(lines: unknown) {
    const { POST } = await import('@/app/api/basket/reprice/route');
    return POST(request('/api/basket/reprice', { method: 'POST', body: { lines } }));
  }

  it('says a line is still fine when nothing has changed', async () => {
    const order = await placeOrder();
    const body = await bodyOf<{ dropped: unknown[]; repriced: unknown[]; lines: unknown[] }>(
      await reprice(order.lines),
    );

    expect(body.dropped).toEqual([]);
    expect(body.repriced).toEqual([]);
    expect(body.lines).toHaveLength(order.lines.length);
  });

  /**
   * The case an operator creates during a service, by pressing a button that
   * exists for exactly this.
   */
  it('drops what has sold out since, and says which', async () => {
    const order = await placeOrder();
    const sold = required(order.lines[0], 'a line to sell out');
    setSoldOut(sold.slug, true);

    const body = await bodyOf<{
      lines: unknown[];
      dropped: { slug: string; problem: string }[];
    }>(await reprice(order.lines));

    expect(body.lines).toEqual([]);
    expect(body.dropped[0]?.slug).toBe(sold.slug);
    expect(body.dropped[0]?.problem).toContain('sold out');
  });

  /** And something taken off the menu entirely, which reads the same way. */
  it('drops a line for something no longer on the menu', async () => {
    const body = await bodyOf<{ dropped: { slug: string; problem: string }[] }>(
      await reprice([orderLine(aProduct(), { slug: 'a-dish-we-stopped-making' })]),
    );

    expect(body.dropped[0]?.problem).toBe('That item is not on the menu');
  });

  /**
   * A price that has moved is not a line to drop.
   *
   * The customer still wants the food; what they must not do is meet the new
   * number for the first time at the till. So the line goes in at today's
   * price and is named as changed — which is the one outcome the order route
   * cannot offer, because by then a total is on screen and the only honest
   * answer is to refuse the lot.
   */
  it('carries a line whose price has moved, at the new price, and says so', async () => {
    const order = await placeOrder();
    const line = required(order.lines[0], 'a line to reprice');
    const stale = { ...line, unitCents: line.unitCents - 1_000 };

    const body = await bodyOf<{
      lines: { slug: string; unitCents: number }[];
      repriced: { slug: string; wasCents: number; nowCents: number }[];
    }>(await reprice([stale]));

    expect(body.lines[0]?.unitCents, 'today’s price').toBe(line.unitCents);
    expect(body.repriced[0]).toEqual({
      slug: line.slug,
      name: line.name,
      wasCents: stale.unitCents,
      nowCents: line.unitCents,
    });
  });

  it('refuses a body that is not a basket', async () => {
    expect((await reprice('everything')).status).toBe(400);
  });
});

/**
 * The half that makes it worth building: the order route still refuses a stale
 * basket, so this is a way to find out before checkout rather than a way around
 * the check.
 */
describe('the order route is unchanged', () => {
  it('still refuses a basket built before something sold out', async () => {
    const order = await placeOrder();
    setSoldOut(required(order.lines[0], 'a line to sell out').slug, true);

    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(
      request('/api/orders', { method: 'POST', body: orderRequest(order.lines) }),
    );

    expect(response.status).toBe(409);
  });
});

/**
 * Structural, and the reason the endpoint exists rather than a second pricing
 * rule in the browser.
 *
 * Both buttons used to copy `unitCents` out of the past order. A component that
 * does that again is a component that has quietly reintroduced this, and it
 * would pass every other test in the suite — the basket looks right, and the
 * refusal arrives four screens later.
 */
describe('both reorder buttons', () => {
  it('ask the server what the basket is worth', () => {
    const reordering = clientCode().filter(({ code }) => /function reorder\b/.test(code));

    expect(reordering.length, 'the journey and the account history').toBe(2);

    for (const { file, code } of reordering) {
      expect(code, `${file} reprices before it adds`).toMatch(/repriceBasket\(/);
    }
  });
});

/**
 * The review build, which had drifted the same way and one step further.
 *
 * It is a second implementation of these rules, so it gets them wrong
 * separately. Its reorder looked the product up in the whole product list
 * rather than the menu — so a hidden item came back — never asked whether
 * anything had sold out, and added every line at the price stored on it.
 *
 * A reviewer marking something sold out in its console and then pressing
 * "order this again" would have watched it reappear in the basket, which is
 * the opposite of the behaviour the tab exists to demonstrate.
 */
describe('the review build orders again the same way', () => {
  const reorder = demoFunction('reorder');

  it('looks the item up on the menu, not in the whole list', () => {
    expect(reorder, 'catalogue() is the one that drops a hidden item').toContain('catalogue()');
  });

  it('leaves out what has sold out', () => {
    expect(reorder).toContain('isSoldOut(');
  });

  /**
   * The line's stored price still appears — it is what today's price is
   * compared against — so what this checks is that it is not the number handed
   * to the basket. A rule reading the whole function for the string would fail
   * on the comparison that makes the message possible.
   */
  it('adds each line at today’s price rather than the stored one', () => {
    expect(reorder).toContain('unitPrice(');
    expect(reorder).not.toMatch(/addLine\([^)]*line\.unitCents/);
  });

  it('says what it left out, rather than dropping it silently', () => {
    expect(reorder).toContain('toast(');
  });
});
