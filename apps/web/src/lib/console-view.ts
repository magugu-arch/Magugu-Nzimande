import { readAudit } from './catalogue-state';
import { unacknowledged } from './fulfilment/handoff';
import { listSuppressed } from './notifications/suppression';
import { labelFor, listOrders } from './order-store';
import { listIntents } from './payments/ledger';

/**
 * Everything the operations console renders, in one shape.
 *
 * Every route the console posts to answers with the whole view rather than with
 * the one thing it changed, so the screen re-renders from the server instead of
 * patching its own copy — an operator watching a queue that two people are
 * working needs the other person's changes too, not just their own.
 *
 * Written once here because it had been written out at each route, and the
 * copies had already diverged: the Problems route returned three of the five
 * fields, so refunding through it would have left the payments list on screen
 * showing the status from before the refund.
 */
export function consoleView() {
  return {
    orders: listOrders().map((order) => ({ ...order, statusLabel: labelFor(order) })),
    audit: readAudit(),
    unacknowledged: unacknowledged(),
    suppressed: listSuppressed(),
    payments: listIntents(),
  };
}
