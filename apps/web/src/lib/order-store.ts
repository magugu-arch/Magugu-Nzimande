import { FEES } from '@bbq/seed';
import {
  completedLabel,
  statesForMode,
  type CreateOrderRequest,
  type Order,
  type OrderState,
  type OrderStatus,
} from '@bbq/types';
import { mutateState, pushAudit, readState } from './demo-state';
import { pointsFor, totalsFor } from './pricing';

/**
 * Orders live in the shared demo store until /services/api exists. The read
 * and write shapes here are the ones the Prisma implementation has to satisfy.
 */

export function createOrder(request: CreateOrderRequest, accountId: string | null = null): Order {
  return mutateState((state) => {
    state.sequence += 1;

    const totals = totalsFor(request.lines, request.mode, request.promoCode);
    // A counter rather than a random number: two orders placed in the same
    // millisecond must not collide on the number a customer reads to the store.
    const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const order: Order = {
      id: `O-${Date.now()}-${state.sequence}`,
      orderNumber: `BBQ-${stamp}-${String(state.sequence).padStart(4, '0')}`,
      storeId: request.storeId,
      mode: request.mode,
      status: 'received',
      customer: request.customer,
      accountId,
      cancelledReason: null,
      placedAt: new Date().toISOString(),
      etaMinutes:
        request.mode === 'Delivery' ? FEES.deliveryEtaMinutes.max : FEES.collectionEtaMinutes,
      lines: request.lines,
      totals,
      promoCode: request.promoCode,
      address: request.mode === 'Delivery' ? (request.address ?? null) : null,
      suburb: request.mode === 'Delivery' ? (request.suburb ?? null) : null,
      postalCode: request.mode === 'Delivery' ? (request.postalCode ?? null) : null,
      kitchenNote: request.kitchenNote,
      pointsEarned: pointsFor(totals.totalCents),
    };

    state.orders.unshift(order);
    // The queue is a working rail, not an archive; a demo store does not need
    // to grow without limit.
    if (state.orders.length > 100) state.orders.length = 100;
    pushAudit(state, 'customer', `Order ${order.orderNumber} placed (${request.mode})`);
    return order;
  });
}

export function readOrder(id: string): Order | null {
  return readState().orders.find((order) => order.id === id) ?? null;
}

export function listOrders(): Order[] {
  return [...readState().orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/**
 * One customer's orders, newest first.
 *
 * Takes an account id rather than a filter, and callers are expected to have
 * got that id off a verified session. A guest order has `accountId: null`, and
 * `null` is never a caller's id, so guest orders belong to nobody rather than
 * to everybody.
 */
export function ordersForAccount(accountId: string): Order[] {
  return listOrders().filter((order) => order.accountId === accountId);
}

export function advanceOrder(id: string): Order | null {
  return mutateState((state) => {
    const index = state.orders.findIndex((order) => order.id === id);
    const order = state.orders[index];
    if (!order) return null;
    if (order.status === 'cancelled') return order;

    const states = statesForMode(order.mode);
    const position = states.indexOf(order.status as OrderState);
    if (position === -1 || position === states.length - 1) return order;

    const next = states[position + 1];
    if (!next) return order;

    const updated: Order = { ...order, status: next };
    state.orders[index] = updated;
    pushAudit(state, 'kitchen', `Order ${order.orderNumber} moved to ${labelFor(updated)}`);
    return updated;
  });
}

export function setOrderStatus(id: string, status: OrderStatus, reason?: string): Order | null {
  if (status === 'cancelled' && !reason) return null;

  return mutateState((state) => {
    const index = state.orders.findIndex((order) => order.id === id);
    const order = state.orders[index];
    if (!order) return null;

    const updated: Order = {
      ...order,
      status,
      cancelledReason: status === 'cancelled' ? (reason ?? null) : null,
    };
    state.orders[index] = updated;
    pushAudit(
      state,
      'operations',
      status === 'cancelled'
        ? `Order ${order.orderNumber} cancelled: ${reason ?? ''}`
        : `Order ${order.orderNumber} moved to ${labelFor(updated)}`,
    );
    return updated;
  });
}

/** The customer-facing name of an order's current state, given its mode. */
export function labelFor(order: Pick<Order, 'status' | 'mode'>): string {
  if (order.status === 'cancelled') return 'Cancelled';
  const labels: Record<OrderState, string> = {
    received: 'Order received',
    preparing: 'Preparing',
    ready: 'Ready',
    out_for_delivery: 'On the way',
    completed: completedLabel(order.mode),
  };
  return labels[order.status];
}
