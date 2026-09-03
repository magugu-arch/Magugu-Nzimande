import { randomBytes } from 'node:crypto';
import type { OrderPayment, PaymentEvent, PaymentIntent, PaymentStatus } from '@bbq/types';
import { isSettled } from '@bbq/types';
import { mutateState, pushAudit, readState } from '../demo-state';
import { readOrder } from '../order-store';
import { isPaymentConfigured } from './registry';

/**
 * The record of what has been asked for and what has been settled.
 *
 * Two things live here and both are about money being taken once:
 *
 *  - An intent per order, so a customer who reloads the payment page twice gets
 *    the same intent rather than a second charge.
 *  - The ids of events already applied, so a gateway redelivering a callback it
 *    never got an acknowledgement for settles the order once.
 *
 * In the shared state file for the same reason as everything else: the server
 * runs several workers, and a ledger held in one of them is a ledger the other
 * ones will happily contradict.
 */

export type SettleResult =
  | { ok: true; intent: PaymentIntent; replayed: boolean }
  | { ok: false; status: number; error: string };

function now(): string {
  return new Date().toISOString();
}

export function readIntent(id: string): PaymentIntent | null {
  return readState().payments.intents.find((intent) => intent.id === id) ?? null;
}

export function intentForOrder(orderId: string): PaymentIntent | null {
  return readState().payments.intents.find((intent) => intent.orderId === orderId) ?? null;
}

export function listIntents(): PaymentIntent[] {
  return [...readState().payments.intents];
}

/**
 * Opens a payment for an order, or hands back the one already open for it.
 *
 * The amount is read off the order here and nowhere else. There is no path
 * through this function that takes a price from a caller, which is the same
 * rule the order route already enforces on its lines: the client says which
 * order, the server says how much.
 *
 * A settled payment is not reopened. Handing back a fresh intent for an order
 * that is already captured is how a customer pays twice for one meal.
 */
export function openIntent(orderId: string, provider: string): SettleResult {
  const order = readOrder(orderId);
  if (!order) return { ok: false, status: 404, error: 'No such order' };

  if (order.status === 'cancelled') {
    return { ok: false, status: 409, error: 'That order was cancelled' };
  }

  const existing = intentForOrder(orderId);
  if (existing) {
    if (isSettled(existing.status)) {
      return {
        ok: false,
        status: 409,
        error: `That order's payment is already ${existing.status}`,
      };
    }
    return { ok: true, intent: existing, replayed: true };
  }

  const intent: PaymentIntent = {
    id: `pi_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    // The one place the amount is decided. Off the order, never off a request.
    amountCents: order.totals.totalCents,
    currency: 'ZAR',
    status: 'pending',
    provider,
    providerRef: null,
    createdAt: now(),
    updatedAt: now(),
    failureReason: null,
  };

  mutateState((state) => {
    state.payments.intents.unshift(intent);
    if (state.payments.intents.length > 500) state.payments.intents.length = 500;
    pushAudit(state, 'payments', `Intent opened for ${order.orderNumber}`);
  });

  return { ok: true, intent, replayed: false };
}

export function recordProviderRef(intentId: string, providerRef: string): void {
  mutateState((state) => {
    const intent = state.payments.intents.find((candidate) => candidate.id === intentId);
    if (!intent) return;
    intent.providerRef = providerRef;
    intent.updatedAt = now();
  });
}

/**
 * Applies a verified event to its intent, exactly once.
 *
 * Callers must have verified the signature before reaching this. Nothing here
 * re-checks it, because a function that both trusts and verifies is one an
 * adapter will eventually call with the trusting half only.
 */
export function settle(event: PaymentEvent): SettleResult {
  const intent = readIntent(event.intentId);
  if (!intent) return { ok: false, status: 404, error: 'No such payment' };

  // The idempotency key. Checked before anything is written, and recorded in
  // the same mutation as the change, so a redelivery cannot slip between the
  // two and apply twice.
  if (readState().payments.appliedEvents.includes(event.id)) {
    return { ok: true, intent, replayed: true };
  }

  // A gateway that reports a different amount from the one we asked for is
  // either misconfigured or talking about somebody else's payment. Neither is
  // something to settle an order on.
  if (event.amountCents !== intent.amountCents) {
    return {
      ok: false,
      status: 409,
      error: 'The settled amount does not match the amount that was asked for',
    };
  }

  if (isSettled(intent.status)) {
    // A second, different event against an already-final payment. Not applied,
    // but not an error either: the provider is entitled to tell us twice.
    return { ok: true, intent, replayed: true };
  }

  const updated = mutateState((state) => {
    const held = state.payments.intents.find((candidate) => candidate.id === event.intentId);
    if (!held) return null;

    held.status = event.status;
    held.providerRef = event.providerRef ?? held.providerRef;
    held.failureReason = event.failureReason;
    held.updatedAt = now();

    state.payments.appliedEvents.push(event.id);
    if (state.payments.appliedEvents.length > 1_000) state.payments.appliedEvents.shift();

    pushAudit(state, 'payments', `${held.orderNumber} payment ${event.status}`);
    return { ...held };
  });

  if (!updated) return { ok: false, status: 404, error: 'No such payment' };
  return { ok: true, intent: updated, replayed: false };
}

/** What the customer's order page should say about the money. */
export function paymentStatusFor(orderId: string): PaymentStatus | null {
  return intentForOrder(orderId)?.status ?? null;
}

/**
 * The whole payment answer for one order, as a screen needs it.
 *
 * Whether payment is required is read here rather than left to the client,
 * because it is a property of the deployment's environment: a browser has no
 * business knowing what this build is configured with, and no business being
 * able to claim it either.
 */
export function paymentFor(orderId: string): OrderPayment {
  return { required: isPaymentConfigured(), status: paymentStatusFor(orderId) };
}
