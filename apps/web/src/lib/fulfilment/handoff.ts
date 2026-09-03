import type { Order } from '@bbq/types';
import { mutateState, pushAudit, readState } from '../demo-state';
import type { CourierAdapter, Handoff, PosAdapter } from './adapters';

/**
 * Handing an order to the kitchen system and to a courier, once each, and
 * knowing which handoffs never happened.
 *
 * The record is the point. Without it, a POS that was down for ten minutes
 * loses ten minutes of orders and nobody finds out until a customer rings. Each
 * attempt is written down with its outcome, so `unacknowledged()` can answer
 * the only question that matters at the end of a service: which orders did the
 * kitchen never see.
 */

export type HandoffKind = 'pos' | 'courier';

export type HandoffRecord = {
  orderId: string;
  orderNumber: string;
  kind: HandoffKind;
  adapter: string;
  ok: boolean;
  reference: string | null;
  error: string | null;
  retryable: boolean;
  at: string;
};

function recordOf(orderId: string, kind: HandoffKind): HandoffRecord | null {
  return (
    readState().fulfilment.handoffs.find(
      (record) => record.orderId === orderId && record.kind === kind,
    ) ?? null
  );
}

function write(record: HandoffRecord): void {
  mutateState((state) => {
    const index = state.fulfilment.handoffs.findIndex(
      (candidate) => candidate.orderId === record.orderId && candidate.kind === record.kind,
    );
    if (index === -1) state.fulfilment.handoffs.unshift(record);
    else state.fulfilment.handoffs[index] = record;

    if (state.fulfilment.handoffs.length > 500) state.fulfilment.handoffs.length = 500;
    pushAudit(
      state,
      record.kind,
      record.ok
        ? `${record.orderNumber} accepted by ${record.adapter}`
        : `${record.orderNumber} not accepted by ${record.adapter}: ${record.error}`,
    );
  });
}

async function attempt(
  order: Order,
  kind: HandoffKind,
  adapter: { name: string },
  run: () => Promise<Handoff>,
): Promise<HandoffRecord> {
  const existing = recordOf(order.id, kind);
  // A success is final. Retrying it would put the same order through the till
  // twice, which a kitchen reads as two of everything.
  if (existing?.ok) return existing;

  let result: Handoff;
  try {
    result = await run();
  } catch (error) {
    // An adapter that throws is an adapter with a bug or a network that died
    // mid-call. Either way the order is not lost: it is recorded as retryable
    // and the console still has it.
    result = {
      ok: false,
      error: error instanceof Error ? error.message : 'The adapter threw',
      retryable: true,
    };
  }

  const record: HandoffRecord = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    kind,
    adapter: adapter.name,
    ok: result.ok,
    reference: result.ok ? result.reference : null,
    error: result.ok ? null : result.error,
    retryable: result.ok ? false : result.retryable,
    at: new Date().toISOString(),
  };

  write(record);
  return record;
}

export async function pushToPos(order: Order, pos: PosAdapter | null): Promise<HandoffRecord | null> {
  // No POS on this deployment. The order still stands and the console is the
  // kitchen display; nothing is recorded, because a handoff that was never
  // attempted is not a failed one and must not show up in the shortfall report.
  if (!pos) return null;
  return attempt(order, 'pos', pos, () => pos.pushOrder(order));
}

export async function requestCourier(
  order: Order,
  courier: CourierAdapter | null,
): Promise<HandoffRecord | null> {
  if (!courier) return null;
  // Only a delivery order needs a driver. Asking for one for a collection is
  // a courier standing in a shop next to a customer who came to fetch it.
  if (order.mode !== 'Delivery') return null;
  return attempt(order, 'courier', courier, () => courier.requestPickup(order));
}

/**
 * Orders that were handed off and not accepted, worst first.
 *
 * The question to ask at the end of a service. An order with no record at all
 * is not in here: on a deployment with no POS every order would qualify, and a
 * report that always lists everything is a report nobody reads.
 */
export function unacknowledged(kind?: HandoffKind): HandoffRecord[] {
  return readState()
    .fulfilment.handoffs.filter((record) => !record.ok && (!kind || record.kind === kind))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function handoffFor(orderId: string, kind: HandoffKind): HandoffRecord | null {
  return recordOf(orderId, kind);
}

/**
 * The order a provider's own reference belongs to.
 *
 * The reverse lookup a courier callback needs. It exists so a webhook can find
 * its order from the delivery id we recorded when we asked for the driver,
 * rather than from an id in the request body — the recorded handoff is the
 * stronger link of the two, because we wrote it.
 */
export function orderIdForReference(kind: HandoffKind, reference: string): string | null {
  return (
    readState().fulfilment.handoffs.find(
      (record) => record.kind === kind && record.reference === reference,
    )?.orderId ?? null
  );
}

/**
 * Availability as the till sees it.
 *
 * Returns false when the POS could not be reached, and the caller is expected
 * to leave the current list alone. Treating "I could not ask" as "nothing is
 * sold out" puts every sold-out item back on the menu the moment the kitchen's
 * network hiccups, and the first anyone hears of it is a customer ordering
 * something that ran out at lunchtime.
 */
export async function syncSoldOut(
  pos: PosAdapter | null,
  apply: (slugs: string[]) => void,
): Promise<boolean> {
  if (!pos) return false;

  let soldOut: string[] | null;
  try {
    soldOut = await pos.fetchSoldOut();
  } catch {
    soldOut = null;
  }

  if (soldOut === null) {
    mutateState((state) =>
      pushAudit(state, 'pos', 'Could not read availability; left it as it was'),
    );
    return false;
  }

  apply(soldOut);
  return true;
}
