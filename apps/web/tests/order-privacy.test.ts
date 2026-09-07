import { OrderSchema, PublicOrderSchema } from '@bbq/types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  advancePublicly,
  blankState,
  bodyOf,
  fetchOrderPublicly,
  fieldsOf,
  personalDetailsOf,
  placeDeliveryOrder,
  placeOrder,
} from './fixtures';

/**
 * What the order endpoints hand to somebody holding nothing but an order id.
 *
 * Both are open by design and have to be. A guest tracking their chicken has no
 * account to sign into, so "GET /api/orders/:id" cannot ask who is calling —
 * and for a long time it answered with the entire order record: the customer's
 * name, their email address, their mobile number, and on a delivery the street
 * and postal code where they live.
 *
 * The order ids are `O-<clock>-<sequence>`. That is not a secret; it is a
 * number that is tedious to guess, which is a different thing. But the id was
 * never the defect. The screen reads eleven fields and was being sent twenty,
 * and no id would have made the other nine safe to send.
 */

beforeEach(blankState);

describe('the public order endpoint', () => {
  /**
   * The sharp one, and the reason it checks values rather than field names.
   *
   * A test asserting `body.order.customer` is undefined passes the moment
   * somebody spreads the customer onto the top level, or writes "for
   * thandi@example.com" into a label, or adds a field nobody thought about.
   * Searching the response text for the customer's own details has no such
   * gap: it does not care which field the leak arrives in.
   */
  it('tells a stranger nothing about the person who ordered', async () => {
    const order = await placeDeliveryOrder();
    const response = await fetchOrderPublicly(order.id);
    const text = JSON.stringify(await bodyOf(response));

    expect(response.status).toBe(200);
    for (const detail of personalDetailsOf(order)) {
      expect(text, `the response contains ${detail}`).not.toContain(detail);
    }
    // By name, because four digits are too short to search a body for — see
    // the note on `personalDetailsOf`.
    expect(order.postalCode, 'the fixture should have placed one').toBeTruthy();
    expect(await bodyOf<{ order: Record<string, unknown> }>(
      await fetchOrderPublicly(order.id),
    ).then((body) => body.order)).not.toHaveProperty('postalCode');
  });

  it('still tells them everything the journey screen shows', async () => {
    const order = await placeOrder();
    const body = await bodyOf<{ order: Record<string, unknown>; statusLabel: string }>(
      await fetchOrderPublicly(order.id),
    );

    expect(body.order.orderNumber).toBe(order.orderNumber);
    expect(body.order.status).toBe('received');
    expect(body.order.totals).toEqual(order.totals);
    expect(body.order.lines).toEqual(order.lines);
    expect(body.statusLabel).toBeTruthy();
  });

  it('answers 404 for an order that does not exist', async () => {
    expect((await fetchOrderPublicly('O-0-0')).status).toBe(404);
  });
});

/**
 * The advance endpoint answers with an order too, on both of its paths.
 *
 * It is the same handler that refuses a non-move with 409 and returns the order
 * alongside the refusal — a body that is easy to forget when the one above it
 * is the one being fixed. Both are checked, because a leak on the error path is
 * still a leak.
 */
describe('the advance endpoint', () => {
  it('tells a stranger nothing when it moves the order', async () => {
    const order = await placeDeliveryOrder();
    const response = await advancePublicly(order.id);
    const text = JSON.stringify(await bodyOf(response));

    expect(response.status).toBe(200);
    for (const detail of personalDetailsOf(order)) {
      expect(text, `the response contains ${detail}`).not.toContain(detail);
    }
  });

  it('tells a stranger nothing when it refuses to move it', async () => {
    const order = await placeDeliveryOrder();
    // Walk it to the end, so the next attempt is the refusal path.
    for (let step = 0; step < 6; step += 1) await advancePublicly(order.id);

    const response = await advancePublicly(order.id);
    const text = JSON.stringify(await bodyOf(response));

    expect(response.status, 'the order should be at its last state').toBe(409);
    for (const detail of personalDetailsOf(order)) {
      expect(text, `the refusal contains ${detail}`).not.toContain(detail);
    }
  });
});

/**
 * What is kept back, named with the reason.
 *
 * The allowlist in `PublicOrderSchema` decides what a stranger sees, and this
 * holds it against the full order so the two cannot drift apart quietly. A
 * field added to `OrderSchema` fails here until somebody writes down which side
 * of the counter it belongs on — which is the decision that was never made the
 * first time.
 */
const KEPT_BACK: Record<string, string> = {
  customer: 'the name, email address and mobile number of the person who ordered',
  address: 'where they live',
  suburb: 'the rest of where they live',
  postalCode: 'the rest of where they live',
  accountId: 'links this order to every other order the same person has placed',
  storeId: 'not shown on the journey; the store is named at checkout',
  promoCode: 'not shown on the journey once the discount is in the totals',
  cancelledReason:
    'written by an operator for operators — an internal note is not a message to the customer',
  pointsPostedAt: 'bookkeeping; the screen shows what the order earned, not when it landed',
};

describe('the line between the two views', () => {
  it('keeps back exactly what is written down here', () => {
    const withheld = fieldsOf(OrderSchema).filter(
      (field) => !fieldsOf(PublicOrderSchema).includes(field),
    );

    expect(
      withheld,
      'a field is kept from the public view without a reason beside it',
    ).toEqual(Object.keys(KEPT_BACK).sort());
  });

  /** A reason for a field that no longer exists is a reason nobody has read. */
  it('gives reasons only for fields the order still has', () => {
    const stale = Object.keys(KEPT_BACK).filter(
      (field) => !fieldsOf(OrderSchema).includes(field),
    );

    expect(stale, 'these are explained and no longer exist').toEqual([]);
  });

  /**
   * And the narrowing is done by the schema, not by hand.
   *
   * `publicOrder` parses, and Zod drops what the schema does not name. Handing
   * it an object with an extra field proves the stripping rather than trusting
   * that eleven properties were copied across without a typo.
   */
  it('drops a field the schema does not name', () => {
    const parsed = PublicOrderSchema.parse({
      ...OrderSchema.parse({
        id: 'O-1-1',
        orderNumber: 'BBQ-1',
        storeId: 'store-1',
        mode: 'Collection',
        status: 'received',
        customer: { name: 'Someone', email: 'a@b.com', mobile: '0821234567' },
        accountId: null,
        cancelledReason: null,
        placedAt: '2026-01-01T00:00:00.000Z',
        etaMinutes: 20,
        lines: [],
        totals: { subtotalCents: 0, discountCents: 0, deliveryCents: 0, totalCents: 0 },
        promoCode: null,
        address: null,
        suburb: null,
        postalCode: null,
        kitchenNote: '',
        pointsEarned: 0,
        courierEtaMinutes: null,
        pointsPostedAt: null,
      }),
    });

    expect(Object.keys(parsed).sort()).toEqual(fieldsOf(PublicOrderSchema));
    expect(parsed).not.toHaveProperty('customer');
  });
});
