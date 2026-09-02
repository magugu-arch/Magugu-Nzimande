import type { FulfilmentType, OrderStatus } from '@/types';

/**
 * The order lifecycle from the brief's §6, and the rules about moving through it.
 *
 * The app's own `OrderStatus` is the six states a *customer* is shown, and it
 * stays that way — the tracking screen has no use for `PAYMENT_AUTHORISED`, and
 * widening the type that every screen reads would be a large change for no
 * customer-visible gain.
 *
 * This is the fuller machine underneath it: the states that carry money and
 * couriers, the transitions that are legal, and the mapping back down to what
 * the customer sees. §6 asks for transitions to be enforced and every critical
 * change logged, which is what this file is for. Enforcement here is the
 * client's half — the server owns the authoritative copy, and this exists so
 * the client cannot ask it for something incoherent, and so the rules are
 * written down once rather than implied by whichever screen moved last.
 */

export type LifecycleState =
  | 'DRAFT'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_AUTHORISED'
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COURIER_REQUESTED'
  | 'COURIER_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COLLECTED'
  | 'CANCELLED'
  | 'REFUNDED';

/**
 * What may follow what.
 *
 * Written as data rather than a switch so the machine can be read, tested and
 * drawn without executing it. Every state appears as a key, including the
 * terminal ones — an empty list is a statement that nothing follows, which is
 * different from a state nobody remembered.
 */
const TRANSITIONS: Record<LifecycleState, readonly LifecycleState[]> = {
  DRAFT: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAYMENT_AUTHORISED', 'CANCELLED'],
  // An authorised payment with no order behind it is the case `submitOrder`
  // exists to unwind, so it can be cancelled and refunded from here.
  PAYMENT_AUTHORISED: ['PLACED', 'CANCELLED', 'REFUNDED'],
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'COURIER_REQUESTED', 'CANCELLED'],
  // Collection and dine-in end here; delivery goes on to a courier.
  READY_FOR_PICKUP: ['COLLECTED', 'COURIER_REQUESTED', 'CANCELLED'],
  COURIER_REQUESTED: ['COURIER_ASSIGNED', 'CANCELLED'],
  COURIER_ASSIGNED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  // A completed order can still be refunded; it cannot go back to the kitchen.
  DELIVERED: ['REFUNDED'],
  COLLECTED: ['REFUNDED'],
  CANCELLED: ['REFUNDED'],
  REFUNDED: [],
};

export const LIFECYCLE_STATES = Object.keys(TRANSITIONS) as LifecycleState[];

export function isTerminal(state: LifecycleState): boolean {
  return TRANSITIONS[state].length === 0;
}

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStates(from: LifecycleState): readonly LifecycleState[] {
  return TRANSITIONS[from];
}

export class IllegalTransitionError extends Error {
  readonly from: LifecycleState;
  readonly to: LifecycleState;

  constructor(from: LifecycleState, to: LifecycleState) {
    super(`An order cannot go from ${from} to ${to}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Moves an order on, or refuses.
 *
 * Throws rather than returning the old state, because a caller that ignores a
 * silent refusal carries on believing the order moved — and the one place that
 * matters is a kitchen screen marking something delivered that was cancelled
 * ten minutes ago.
 */
export function transition(from: LifecycleState, to: LifecycleState): LifecycleState {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
  return to;
}

/** A logged change, which §6 asks for on every critical state move. */
export interface OrderLifecycleEvent {
  from: LifecycleState;
  to: LifecycleState;
  at: string;
  /** Who moved it: the customer, the kitchen, the courier, the gateway. */
  actor: 'customer' | 'kitchen' | 'courier' | 'payments' | 'system';
  reason?: string;
}

export function recordTransition(
  from: LifecycleState,
  to: LifecycleState,
  actor: OrderLifecycleEvent['actor'],
  reason?: string,
  now: Date = new Date(),
): OrderLifecycleEvent {
  transition(from, to);
  return {
    from,
    to,
    at: now.toISOString(),
    actor,
    ...(reason ? { reason } : {}),
  };
}

/**
 * What the customer is shown for a given lifecycle state.
 *
 * The states before an order exists all read as `received` because that is
 * what the customer has been told — they tapped Place order and the app said
 * it had the order. Exposing AWAITING_PAYMENT would be honest to the system
 * and meaningless to the person holding the phone.
 */
export function customerStatus(state: LifecycleState): OrderStatus {
  switch (state) {
    case 'DRAFT':
    case 'AWAITING_PAYMENT':
    case 'PAYMENT_AUTHORISED':
    case 'PLACED':
    case 'ACCEPTED':
      return 'received';
    case 'PREPARING':
      return 'preparing';
    case 'READY_FOR_PICKUP':
    case 'COURIER_REQUESTED':
    case 'COURIER_ASSIGNED':
      return 'ready';
    case 'OUT_FOR_DELIVERY':
      return 'out_for_delivery';
    case 'DELIVERED':
    case 'COLLECTED':
      return 'completed';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'cancelled';
  }
}

/**
 * The path an order of this kind actually takes.
 *
 * Delivery goes through a courier; collection and dine-in do not, and offering
 * a courier state on a collection order is how a tracking screen ends up
 * waiting for a driver who was never coming.
 */
export function lifecycleFor(fulfilmentType: FulfilmentType): LifecycleState[] {
  const common: LifecycleState[] = [
    'DRAFT',
    'AWAITING_PAYMENT',
    'PAYMENT_AUTHORISED',
    'PLACED',
    'ACCEPTED',
    'PREPARING',
  ];

  if (fulfilmentType === 'delivery') {
    return [
      ...common,
      'COURIER_REQUESTED',
      'COURIER_ASSIGNED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
  }

  return [...common, 'READY_FOR_PICKUP', 'COLLECTED'];
}
