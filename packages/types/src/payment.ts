import { z } from 'zod';

/**
 * Payments, described provider-independently.
 *
 * No gateway has been selected and no merchant credentials exist, so nothing
 * here names one. What it does fix is the shape every gateway has to be adapted
 * to — an intent for an amount the server decided, and a signed event that
 * settles it exactly once — so that choosing a provider is an adapter and a
 * secret rather than a rewrite of the checkout.
 *
 * The states are deliberately fewer than any real gateway offers. A provider
 * that distinguishes six kinds of pending maps them all onto `pending` here;
 * the ones that matter to an order are whether the money is promised, taken,
 * refused or returned.
 */

export const PAYMENT_STATUSES = [
  'pending',
  'authorised',
  'captured',
  'failed',
  'refunded',
] as const;

export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/**
 * A payment attempt against one order.
 *
 * `amountCents` is written by the server from the order it belongs to. It is
 * not a field a client may set, and there is no schema here that would let one:
 * the request that opens an intent names an order, not a price.
 */
export const PaymentIntentSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  currency: z.literal('ZAR'),
  status: PaymentStatusSchema,
  provider: z.string().min(1),
  /** The provider's own identifier, for reconciliation against their dashboard. */
  providerRef: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  /** Why a payment failed, in the provider's words, for support to read. */
  failureReason: z.string().min(1).nullable(),
});
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;

/** What a client may ask for: a payment against an order it already placed. */
export const CreatePaymentIntentRequestSchema = z.object({
  orderId: z.string().min(1),
});
export type CreatePaymentIntentRequest = z.infer<typeof CreatePaymentIntentRequestSchema>;

/**
 * One settlement event, as an adapter hands it over after verifying it.
 *
 * `id` is the provider's event id and is the idempotency key: a gateway that
 * cannot get an acknowledgement will redeliver, and a redelivered capture must
 * not take the money twice or move the order twice.
 */
export const PaymentEventSchema = z.object({
  id: z.string().min(1),
  intentId: z.string().min(1),
  status: PaymentStatusSchema,
  providerRef: z.string().min(1).nullable().default(null),
  amountCents: z.number().int().nonnegative(),
  failureReason: z.string().min(1).nullable().default(null),
});
export type PaymentEvent = z.infer<typeof PaymentEventSchema>;

/** Terminal states. A settled payment does not move again. */
export function isSettled(status: PaymentStatus): boolean {
  return status === 'captured' || status === 'failed' || status === 'refunded';
}

/**
 * What an order screen is told about the money.
 *
 * Two facts rather than one, because they answer different questions and the
 * screen needs both. `required` is about the deployment — has a gateway been
 * configured at all — and `status` is about this order. Collapsing them into a
 * single nullable status would make "this build takes no payments" and "this
 * order has not been paid yet" the same value, and those want opposite words:
 * the first is a demonstration build behaving correctly, the second is a
 * customer whose food is not coming.
 */
export const OrderPaymentSchema = z.object({
  required: z.boolean(),
  status: PaymentStatusSchema.nullable(),
});
export type OrderPayment = z.infer<typeof OrderPaymentSchema>;

/**
 * Whether the kitchen should be working on an order in this payment state.
 *
 * The one place that decides it, so the journey screen, the console and the
 * order endpoint cannot drift apart on the question of what "paid" means. A
 * deployment with no gateway configured cooks everything — that is what a
 * demonstration build is — and one with a gateway waits for the money.
 */
export function kitchenMayStart(payment: OrderPayment): boolean {
  return !payment.required || payment.status === 'captured';
}
