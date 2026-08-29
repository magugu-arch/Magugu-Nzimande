import { FEES } from '@bbq/seed';
import {
  completedLabel,
  statesForMode,
  type CreateOrderRequest,
  type Order,
  type OrderState,
  type OrderStatus,
} from '@bbq/types';
import { pointsFor, totalsFor } from './pricing';
import { recordAudit } from './catalogue-state';

/**
 * Orders live in process until the Postgres layer lands. The read and write
 * shapes here are the ones the Prisma implementation has to satisfy.
 */
const orders = new Map<string, Order>();

let sequence = 0;

function nextOrderNumber(): string {
  sequence += 1;
  // A per-process counter rather than a random number: two orders placed in the
  // same millisecond must not be able to collide on the number a customer reads
  // out to the store.
  const suffix = String(sequence).padStart(4, '0');
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `BBQ-${stamp}-${suffix}`;
}

export function createOrder(request: CreateOrderRequest): Order {
  const totals = totalsFor(request.lines, request.mode, request.promoCode);
  const id = `O-${Date.now()}-${sequence + 1}`;
  const order: Order = {
    id,
    orderNumber: nextOrderNumber(),
    storeId: request.storeId,
    mode: request.mode,
    status: 'received',
    cancelledReason: null,
    placedAt: new Date().toISOString(),
    etaMinutes:
      request.mode === 'Delivery' ? FEES.deliveryEtaMinutes.max : FEES.collectionEtaMinutes,
    lines: request.lines,
    totals,
    promoCode: request.promoCode,
    address: request.mode === 'Delivery' ? (request.address ?? null) : null,
    kitchenNote: request.kitchenNote,
    pointsEarned: pointsFor(totals.totalCents),
  };
  orders.set(id, order);
  recordAudit('customer', `Order ${order.orderNumber} placed (${request.mode})`);
  return order;
}

export function readOrder(id: string): Order | null {
  return orders.get(id) ?? null;
}

export function listOrders(): Order[] {
  return [...orders.values()].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

export function advanceOrder(id: string): Order | null {
  const order = orders.get(id);
  if (!order || order.status === 'cancelled') return null;

  const states = statesForMode(order.mode);
  const index = states.indexOf(order.status as OrderState);
  if (index === -1 || index === states.length - 1) return order;

  const next = states[index + 1];
  if (!next) return order;

  const updated: Order = { ...order, status: next };
  orders.set(id, updated);
  recordAudit('kitchen', `Order ${order.orderNumber} moved to ${labelFor(updated)}`);
  return updated;
}

export function setOrderStatus(id: string, status: OrderStatus, reason?: string): Order | null {
  const order = orders.get(id);
  if (!order) return null;

  if (status === 'cancelled' && !reason) return null;

  const updated: Order = {
    ...order,
    status,
    cancelledReason: status === 'cancelled' ? (reason ?? null) : null,
  };
  orders.set(id, updated);
  recordAudit(
    'operations',
    status === 'cancelled'
      ? `Order ${order.orderNumber} cancelled: ${reason ?? ''}`
      : `Order ${order.orderNumber} moved to ${labelFor(updated)}`,
  );
  return updated;
}

/** The customer-facing name of an order's current state, given its mode. */
export function labelFor(order: Pick<Order, 'status' | 'mode'>): string {
  if (order.status === 'cancelled') return 'Cancelled';
  if (order.status === 'completed') return completedLabel(order.mode);
  const labels: Record<OrderState, string> = {
    received: 'Order received',
    preparing: 'Preparing',
    ready: 'Ready',
    out_for_delivery: 'On the way',
    completed: completedLabel(order.mode),
  };
  return labels[order.status];
}
