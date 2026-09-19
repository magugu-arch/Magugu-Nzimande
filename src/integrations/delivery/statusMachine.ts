/**
 * The canonical Pappas order state machine.
 *
 * Brief §1: "Normalize all provider order states into one PAPPAS order state
 * machine." §11 makes it an acceptance criterion. This file is that machine —
 * which states exist is in `types.ts`; which moves are legal is here.
 *
 * Why a machine rather than "last event wins":
 *
 * Webhooks arrive out of order. A courier-assigned event and a preparing
 * event dispatched half a second apart can land in either sequence, and a
 * delivered order that then receives a late preparing event must not reopen.
 * Ordering by `occurredAt` helps and is not sufficient — providers stamp their
 * own clocks and two providers do not share one. So the rule is: a transition
 * is applied only if it moves the order forward, or is a terminal state, and
 * every rejected transition is recorded rather than dropped silently.
 *
 * Brief §7 also asks for human-readable states — "Preparing your order",
 * "Ready for collection", "Your courier is on the way". Those live here too,
 * beside the states they describe, so an engineer changing a state cannot
 * miss that a customer reads something because of it. Collection and delivery
 * need different words for the same canonical state, which is why
 * `describeStatus` takes the fulfilment mode.
 */

import type { CanonicalOrderStatus, FulfilmentMode } from './types';

/**
 * How far through the journey each state is.
 *
 * Terminal states share the top rank; they are distinguished by
 * `isTerminal`, not by ordering, because "cancelled" is not further along
 * than "delivered", it is simply also final.
 */
const RANK: Record<CanonicalOrderStatus, number> = {
  draft: 0,
  submitted: 1,
  accepted: 2,
  preparing: 3,
  ready: 4,
  'driver-assigned': 5,
  'picked-up': 6,
  'out-for-delivery': 7,
  delivered: 8,
  cancelled: 8,
  failed: 8,
};

const TERMINAL: ReadonlySet<CanonicalOrderStatus> = new Set([
  'delivered',
  'cancelled',
  'failed',
]);

export function isTerminalStatus(status: CanonicalOrderStatus): boolean {
  return TERMINAL.has(status);
}

/**
 * States that only make sense for a delivery.
 *
 * A pickup order that receives `out-for-delivery` is a provider mapping bug,
 * not a state to render. `applyStatus` refuses it rather than showing a
 * collection customer a courier who does not exist.
 */
const DELIVERY_ONLY: ReadonlySet<CanonicalOrderStatus> = new Set([
  'driver-assigned',
  'picked-up',
  'out-for-delivery',
]);

export type TransitionOutcome =
  | { applied: true; status: CanonicalOrderStatus }
  | {
      applied: false;
      status: CanonicalOrderStatus;
      rejection: 'already-terminal' | 'not-forward' | 'mode-mismatch';
    };

/**
 * Apply an incoming status to an order, returning the state it should hold.
 *
 * Never throws: a malformed provider event must not take down order history.
 * The caller logs `rejection` — a burst of `mode-mismatch` is how a provider
 * mapping error becomes visible instead of becoming a support ticket.
 */
export function applyStatus(
  current: CanonicalOrderStatus,
  incoming: CanonicalOrderStatus,
  fulfilment: FulfilmentMode,
): TransitionOutcome {
  if (isTerminalStatus(current)) {
    // `cancelled` may not overwrite `delivered`, nor the reverse. Once an
    // order is finished it is finished, whatever arrives afterwards.
    return { applied: false, status: current, rejection: 'already-terminal' };
  }

  if (fulfilment === 'pickup' && DELIVERY_ONLY.has(incoming)) {
    return { applied: false, status: current, rejection: 'mode-mismatch' };
  }

  // Terminal states are always allowed forward from a non-terminal state: a
  // cancellation can arrive at any point and must land.
  if (isTerminalStatus(incoming)) {
    return { applied: true, status: incoming };
  }

  if (RANK[incoming] <= RANK[current]) {
    return { applied: false, status: current, rejection: 'not-forward' };
  }

  return { applied: true, status: incoming };
}

export interface StatusCopy {
  /** Short label for a timeline row or status chip. */
  label: string;
  /** One sentence the customer reads on the tracking card. */
  detail: string;
}

/**
 * Brief §7's human-readable states.
 *
 * Deliberately free of exclamation marks, countdowns and courier nicknames.
 * §15's guardrail — do not turn Pappas into a fast-food UI — applies to
 * language as much as layout, and an order status is the screen a customer
 * stares at longest.
 */
export function describeStatus(
  status: CanonicalOrderStatus,
  fulfilment: FulfilmentMode,
): StatusCopy {
  const pickup = fulfilment === 'pickup';

  switch (status) {
    case 'draft':
      return { label: 'Not yet placed', detail: 'This order has not been sent to the kitchen.' };
    case 'submitted':
      return {
        label: 'Sent to Pappas',
        detail: 'We have your order and the kitchen is about to confirm it.',
      };
    case 'accepted':
      return {
        label: 'Confirmed',
        detail: 'Pappas has accepted your order.',
      };
    case 'preparing':
      return {
        label: 'Preparing your order',
        detail: 'Your dishes are being prepared in the Pappas kitchen.',
      };
    case 'ready':
      return pickup
        ? {
            label: 'Ready for collection',
            detail: 'Your order is ready. Collect it from the host desk at Pappas.',
          }
        : {
            label: 'Ready',
            detail: 'Your order is packed and waiting for a courier.',
          };
    case 'driver-assigned':
      return {
        label: 'Courier assigned',
        detail: 'A courier is on the way to collect your order.',
      };
    case 'picked-up':
      return {
        label: 'Collected from Pappas',
        detail: 'Your order has left the restaurant.',
      };
    case 'out-for-delivery':
      return {
        label: 'On the way',
        detail: 'Your courier is on the way to you.',
      };
    case 'delivered':
      return pickup
        ? { label: 'Collected', detail: 'Thank you. We hope you enjoy it.' }
        : { label: 'Delivered', detail: 'Thank you. We hope you enjoy it.' };
    case 'cancelled':
      return {
        label: 'Cancelled',
        detail: 'This order was cancelled. Any payment taken will be reversed.',
      };
    case 'failed':
      return {
        label: 'Could not be placed',
        detail: 'We could not complete this order. You have not been charged.',
      };
  }
}

/**
 * The states a tracking timeline should draw for a given fulfilment mode.
 *
 * Drawn from the machine rather than typed out in a component, so a timeline
 * cannot drift from the states the machine can actually reach. `draft` is
 * excluded — a customer never tracks an order they have not placed — and the
 * terminal failure states are excluded because they replace the timeline
 * rather than appearing as a step in it.
 */
export function timelineFor(fulfilment: FulfilmentMode): CanonicalOrderStatus[] {
  const shared: CanonicalOrderStatus[] = ['submitted', 'accepted', 'preparing', 'ready'];
  return fulfilment === 'pickup'
    ? [...shared, 'delivered']
    : [...shared, 'driver-assigned', 'out-for-delivery', 'delivered'];
}
