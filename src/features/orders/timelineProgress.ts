import type { Order } from '@/types';

/**
 * How far along an order is, read from its timeline.
 *
 * Three screens drew this bar and all three computed it inline — order
 * tracking, the Orders tab, and the live card on Home. Two of them crashed
 * against a backend that sent no `timeline` at all, which is a backend keeping
 * its side of the bargain: `checkOrder` asks for the id, the five totals and
 * `etaMinutes`, because those are the numbers the app does arithmetic with. A
 * list of events it only draws is not checked, by design.
 *
 * Last round guarded `data.timeline.length` on the tracking screen and left
 * `.filter` on all three, because the grep that found it looked for one shape.
 * `audit:sparse` found the rest by driving them. The fix follows the sweep,
 * and wherever the sweep never went the hole stayed open — which is the oldest
 * lesson in this repository and the second round running it has applied.
 *
 * So it is one function. A fourth screen cannot get this wrong privately, and
 * an absent timeline reads as an order that has not started rather than as an
 * app that has broken.
 */
export interface OrderProgress {
  /** Events that have actually happened. */
  completed: number;
  /** Events the timeline carries at all. */
  total: number;
  /** 0 to 1, for a progress bar. Zero events reads as zero progress. */
  fraction: number;
}

export function orderProgress(order: Pick<Order, 'timeline'>): OrderProgress {
  const timeline = order.timeline ?? [];
  const completed = timeline.filter((event) => event.occurredAt !== null).length;

  return {
    completed,
    total: timeline.length,
    // `Math.max(1, …)` rather than a zero check: a timeline with no events is
    // an order nobody has moved yet, and 0/1 is the honest reading of that.
    fraction: completed / Math.max(1, timeline.length),
  };
}
