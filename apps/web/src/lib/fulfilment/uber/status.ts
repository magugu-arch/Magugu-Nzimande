import type { OrderStatus } from '@bbq/types';

/**
 * Uber's delivery statuses, mapped onto ours.
 *
 * Two vocabularies are handled, and that is not defensiveness for its own sake:
 * Uber's older delivery API reports lower-case statuses (`pending`, `pickup`,
 * `dropoff`, `delivered`) while the newer Direct endpoints report upper-case
 * ones (`EN_ROUTE_TO_PICKUP`, `ARRIVED_AT_DROPOFF`, `COMPLETED`, `FAILED`).
 * Which one an account receives depends on when it was provisioned and which
 * endpoints it is on, so an adapter that knows only one will look correct in
 * testing and go silent in production.
 */

export type CourierPhase =
  | 'assigned'
  | 'collecting'
  | 'delivering'
  | 'delivered'
  | 'failed'
  | 'returned';

const PHASES: Record<string, CourierPhase> = {
  // Uber Direct, older vocabulary.
  pending: 'assigned',
  pickup: 'collecting',
  pickup_complete: 'delivering',
  dropoff: 'delivering',
  delivered: 'delivered',
  canceled: 'failed',
  cancelled: 'failed',
  returned: 'returned',

  // Uber Direct, newer vocabulary.
  scheduled: 'assigned',
  en_route_to_pickup: 'collecting',
  arrived_at_pickup: 'collecting',
  en_route_to_dropoff: 'delivering',
  arrived_at_dropoff: 'delivering',
  completed: 'delivered',
  failed: 'failed',
};

/**
 * Null for a status neither vocabulary knows.
 *
 * Not guessed at. A status Uber adds later leaves the order where it is and is
 * logged, which is recoverable; inventing a meaning for it could mark an order
 * delivered that is sitting in a car.
 */
export function phaseOf(uberStatus: string): CourierPhase | null {
  return PHASES[uberStatus.trim().toLowerCase()] ?? null;
}

/**
 * What an order should become, given where the courier is.
 *
 * Deliberately partial. A courier collecting the food does not move the order —
 * the kitchen already marked it ready, and `out_for_delivery` is the state that
 * means a driver has it. `assigned` and `collecting` return null because there
 * is nothing for the customer to be told that they do not already know.
 */
export function orderStatusFor(phase: CourierPhase): OrderStatus | null {
  switch (phase) {
    case 'delivering':
      return 'out_for_delivery';
    case 'delivered':
      return 'completed';
    case 'failed':
    case 'returned':
      // Not cancelled automatically. A failed delivery is a decision — refund,
      // redeliver, or the customer collects — and cancelling an order the
      // kitchen has already cooked is not one an adapter should take.
      return null;
    default:
      return null;
  }
}
