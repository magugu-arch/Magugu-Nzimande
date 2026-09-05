import type { Order, OrderStatusEvent } from '@/types';
import { minutesUntilDue, readyLabelFor, statusCopy } from '@/services/orderService';

/**
 * What the tracking screen's hero is entitled to say about an order that is
 * still open — and, twice over, what it is not.
 *
 * Both cases were found by seeding a state the ledger had never held.
 */

/**
 * The courier gave up: nobody home, the gate locked, an address that turned
 * out not to exist.
 *
 * `FAILED` is a member of `DeliveryStatus` and the mock's progression walked
 * from `ON_THE_WAY` straight to `DELIVERED`, so it had never once been
 * reported. Behind it sat a screen that could not tell anybody:
 * `deliveryStatusToOrderStatus` maps `FAILED` to `'ready'`, and
 * `attachDelivery` is deliberately forward-only, so an order already at
 * `out_for_delivery` keeps that status and the hero goes on reading "Out for
 * delivery · Your driver has collected the order and is on the way" with an
 * estimate counting down. Fifty-one minutes after the courier turned back,
 * that is what the browser showed.
 *
 * The mapping and the forward-only rule are both right and are both left
 * alone: `FAILED` does mean the kitchen finished, and a courier's outcome must
 * never silently cancel a customer's order — `cancelOrder` is the only thing
 * that cancels one. What was missing is that the job, not the order status, is
 * the authority on the courier leg, and nothing was reading it.
 */
export function deliveryFailed(order: Pick<Order, 'delivery'>): boolean {
  return order.delivery?.status === 'FAILED';
}

/**
 * Whether the countdown still describes something that has not happened.
 *
 * `etaMinutes` measures the wait until the food is ready. For a delivery the
 * road is still ahead at `ready`, so the estimate goes on meaning something.
 * For collection and dine-in `ready` *is* the last step — the food is boxed
 * and on the counter — and the estimate has nothing left to measure.
 *
 * Seeding a collection order at `ready` is what showed it: the hero read
 * "Ready · Boxed, sealed and ready to go" and, one line below, "Ready for
 * collection in 9 – 19 min". The kitchen had finished early and the screen
 * contradicted itself in two adjacent sentences, telling somebody to wait for
 * food already waiting for them.
 *
 * A failed delivery has nothing to count down to either.
 */
export function countdownStillApplies(
  order: Pick<Order, 'status' | 'fulfilmentType' | 'delivery'>,
): boolean {
  if (deliveryFailed(order)) return false;
  if (order.fulfilmentType === 'delivery') return true;
  return order.status !== 'ready';
}

/**
 * The heading and sentence for an open order.
 *
 * `statusCopy` unless the courier leg has overruled it. The wording says what
 * happened and where the food is, and stops there: whether bb.q refunds,
 * redelivers or holds it at the branch is an operations decision nobody has
 * given, and `audit:launch` carries it as a blocker. Calling the store is
 * something the screen already offers, so pointing at it invents nothing.
 */
export function liveStatusCopy(order: Pick<Order, 'status' | 'fulfilmentType' | 'delivery'>): {
  label: string;
  description: string;
} {
  if (deliveryFailed(order)) {
    return {
      label: 'Delivery unsuccessful',
      description:
        'Your driver could not complete this delivery, so your order has gone back to the store. Please call them to sort it out.',
    };
  }

  const copy = statusCopy(order.status);

  /*
    "Ready" is the kitchen's word for every order. On the counter it is the
    customer's cue to walk over, and the timeline three lines below already
    says "Ready for collection" — `readyLabelFor` has said so since the
    timeline was written. The hero said "Ready", so the same fact appeared
    twice on one screen in two different words, and the vaguer one was the
    headline. Derived from the same helper rather than restated beside it.
  */
  if (order.status === 'ready' && order.fulfilmentType !== 'delivery') {
    return { ...copy, label: readyLabelFor(order.fulfilmentType) };
  }

  return copy;
}

/**
 * The steps worth drawing.
 *
 * A failed delivery really did get as far as "Out for delivery", so that
 * history stands. What must not stand is the step after it: the seeded failure
 * left "Completed · Enjoy. Thanks for ordering with bb.q." sitting at the
 * bottom of the list, greyed and undated, as though it were still on its way.
 * It is not coming. The same reasoning `buildTimeline` already applies to a
 * cancelled order, which is shown the two steps that happened and no journey.
 */
export function timelineFor(order: Pick<Order, 'timeline' | 'delivery'>): OrderStatusEvent[] {
  if (!deliveryFailed(order)) return order.timeline;

  const lastReached = order.timeline.reduce(
    (last, event, index) => (event.occurredAt !== null ? index : last),
    -1,
  );
  return order.timeline.slice(0, lastReached + 1);
}

/**
 * Past the estimate, and still cooking.
 *
 * The countdown is dropped once `minutesUntilDue` goes negative, and that is
 * right — "a time nobody believes any more is worse than no time at all", as
 * the tracking screen's own note puts it. What was missing is anything in its
 * place: twenty-three minutes past a twenty-five minute estimate, the screen
 * showed the same status sentence and the same progress bar as an order two
 * minutes old, and said nothing at all about the wait.
 *
 * Nobody had seen it because the mock kitchen was never late. `advance` is a
 * pure function of elapsed time, so every order arrived exactly when the
 * estimate said it would; backdating a fixture just walked it to `completed`
 * before anybody looked. `RUNNING_LATE` in the order service is what makes the
 * state reachable.
 *
 * What the app says is the fact and nothing more. A revised time would have to
 * come from the kitchen, and there is no endpoint that carries one; what bb.q
 * does about a late order is an operations decision, and `audit:launch` asks
 * for it.
 */
export function runningLate(order: Order, now: Date = new Date()): boolean {
  if (order.status === 'completed' || order.status === 'cancelled') return false;
  if (deliveryFailed(order)) return false;
  if (!countdownStillApplies(order)) return false;
  return minutesUntilDue(order, now) <= 0;
}

/** The line that stands where the countdown was. */
export const RUNNING_LATE_LABEL = 'Taking longer than expected';

/**
 * What the badge beside the store name says.
 *
 * "In progress" was true of anything not finished or cancelled, which put it
 * over a delivery that had stopped an hour ago.
 */
export function liveStatusTone(
  order: Pick<Order, 'status' | 'delivery'>,
): 'primary' | 'warning' | 'success' {
  if (order.status === 'cancelled' || deliveryFailed(order)) return 'warning';
  if (order.status === 'completed') return 'success';
  return 'primary';
}

export function liveStatusBadge(order: Pick<Order, 'status' | 'delivery'>): string {
  if (deliveryFailed(order)) return 'Needs attention';
  if (order.status === 'cancelled') return 'Cancelled';
  if (order.status === 'completed') return 'Completed';
  return 'In progress';
}
