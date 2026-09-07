import { beforeEach, describe, expect, it } from 'vitest';
import { consoleView } from '@/lib/console-view';
import { owedRefunds } from '@/lib/payments/owed';
import { intentForOrder, refundPayment } from '@/lib/payments/ledger';
import { setOrderStatus } from '@/lib/order-store';
import {
  aCancelledPaidOrder,
  aPaidOrder,
  blankState,
  owedOrderNumbers,
  placeOrder,
  webFile,
  withPaymentProvider,
} from './fixtures';

/**
 * Money taken for orders that were called off.
 *
 * Cancelling an order writes a status and a reason and does nothing about the
 * payment. That is right as far as it goes: whether to refund, and how quickly,
 * is the franchisor's decision, and a cancellation for suspected fraud is not
 * the same as one for a kitchen that lost power. Nothing here refunds anything
 * on its own.
 *
 * What was wrong is that nobody was told. The order said cancelled, the payment
 * said captured, and the Problems tab — which reports handoffs the kitchen never
 * acknowledged and addresses we have stopped emailing — had no row for a
 * customer who had paid for food that will never arrive. The refund endpoint had
 * been built and nothing pointed at the orders that needed it.
 *
 * The state had never been assembled in a test either, which is the same fact
 * from the other side: `aPaidOrder` stops at paid, and the console suites cancel
 * orders nobody paid for.
 */

beforeEach(blankState);

describe('a paid order that gets cancelled', () => {
  it('still holds the customer’s money', async () => {
    const order = await aCancelledPaidOrder();

    expect(order.status).toBe('cancelled');
    expect(intentForOrder(order.id)?.status, 'nothing gave it back').toBe('captured');
  });

  it('is reported as owed, which it was not before', async () => {
    const order = await aCancelledPaidOrder();

    expect(owedOrderNumbers()).toEqual([order.orderNumber]);
  });

  it('says how much, and why the order was called off', async () => {
    const order = await aCancelledPaidOrder('load shedding, no power to cook');
    const [entry] = owedRefunds();

    expect(entry?.amountCents).toBe(order.totals.totalCents);
    expect(entry?.reason).toBe('load shedding, no power to cook');
    expect(entry?.orderId).toBe(order.id);
  });

  /** The operator needs it to find the payment in the gateway's dashboard. */
  it('carries the provider reference', async () => {
    await aCancelledPaidOrder();
    expect(owedRefunds()[0]?.providerRef).toBeTruthy();
  });
});

describe('what is not owed', () => {
  it('a cancelled order nobody paid for', async () => {
    const order = await placeOrder();
    setOrderStatus(order.id, 'cancelled', 'customer changed their mind');

    expect(owedRefunds()).toEqual([]);
  });

  it('a paid order that is still going', async () => {
    await withPaymentProvider(async () => {
      await aPaidOrder();
    });

    expect(owedRefunds()).toEqual([]);
  });

  /**
   * And one already refunded, which is the row that would make this the report
   * nobody reads — the same way the shortfall report listed every order on a
   * deployment with no POS until it stopped counting handoffs never attempted.
   */
  it('a cancelled order that has already been refunded', async () => {
    await withPaymentProvider(async () => {
      const order = await aCancelledPaidOrder();
      expect(owedRefunds(), 'owed before the refund').toHaveLength(1);

      const result = await refundPayment(order.id, 'cancelled, giving it back');
      expect(result.ok).toBe(true);

      expect(owedRefunds(), 'and settled after it').toEqual([]);
    });
  });
});

describe('the console', () => {
  it('carries the report alongside the other two', async () => {
    await aCancelledPaidOrder();
    const view = consoleView();

    expect(view.owed).toHaveLength(1);
    // The other two shortfall reports are still there — this was added beside
    // them rather than in place of one.
    expect(view).toHaveProperty('unacknowledged');
    expect(view).toHaveProperty('suppressed');
  });

  it('reports nothing when nothing is owed', async () => {
    await placeOrder();
    expect(consoleView().owed).toEqual([]);
  });

  /**
   * Structural, and deliberately so: the report is only worth building if an
   * operator can see it and act on it. A field on the response that no screen
   * renders is the defect this whole exercise keeps finding.
   */
  it('shows it on the Problems tab, with the refund button beside it', () => {
    const source = webFile('src/components/admin/OperationsConsole.tsx');

    expect(source, 'the heading').toContain('Cancelled orders still holding');
    expect(source, 'the rows').toContain('owed.map(');
    expect(source, 'and the action').toContain('refundPayment(entry.orderId, entry.orderNumber)');
  });

  it('counts it in the badge on the tab', () => {
    const source = webFile('src/components/admin/OperationsConsole.tsx');
    const line = source
      .split('\n')
      .find((candidate) => candidate.includes('const problemCount'));

    expect(line, 'a problem the tab does not count is a problem nobody opens').toContain(
      'owed.length',
    );
  });
});
