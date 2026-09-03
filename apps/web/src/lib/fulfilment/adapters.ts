import type { Order } from '@bbq/types';

/**
 * The two systems an order has to reach that this deployment cannot talk to:
 * the kitchen's point of sale, and a courier.
 *
 * Neither has been contracted, so neither has an adapter here for a named
 * vendor. What is fixed is the shape, and one decision that is different from
 * the payment seam and worth stating plainly:
 *
 *   An unconfigured payment provider refuses the payment. An unconfigured POS
 *   or courier does not refuse the order.
 *
 * Money that cannot be taken must not look taken — hence the 501 on payments.
 * But an order that reaches no POS still reaches the operations console, which
 * is a working kitchen display; and an order that reaches no courier is still
 * an order a store can drive out itself. Refusing those would turn a missing
 * integration into a closed shop, which is worse than the thing it prevents.
 *
 * So both of these degrade rather than refuse, and the health endpoint reports
 * which are attached so nobody has to guess.
 */

export type Handoff =
  | { ok: true; reference: string }
  | { ok: false; error: string; retryable: boolean };

export interface PosAdapter {
  readonly name: string;
  /** Puts an accepted order in front of the kitchen. */
  pushOrder(order: Order): Promise<Handoff>;
  /**
   * What the till says is off the menu right now.
   *
   * Null when the POS cannot be reached, which is deliberately different from
   * an empty list: "nothing is sold out" and "I could not ask" must not be the
   * same answer, or an unreachable POS silently puts everything back on sale.
   */
  fetchSoldOut(): Promise<string[] | null>;
}

export interface CourierAdapter {
  readonly name: string;
  requestPickup(order: Order): Promise<Handoff>;
  /** Where the driver is, or null if the courier has nothing to say yet. */
  track(reference: string): Promise<{ status: string; etaMinutes: number | null } | null>;
}
