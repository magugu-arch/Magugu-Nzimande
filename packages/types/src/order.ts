import { z } from 'zod';
import { ServiceModeSchema } from './store';

/**
 * States run in this order. Collection and dine-in skip out_for_delivery and
 * relabel completed as Collected or Served. cancelled is terminal from any
 * state and requires a reason.
 */
export const ORDER_STATES = [
  'received',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
] as const;

export const OrderStateSchema = z.enum(ORDER_STATES);
export type OrderState = z.infer<typeof OrderStateSchema>;

export const OrderStatusSchema = z.union([
  OrderStateSchema,
  z.literal('cancelled'),
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const SelectedOptionSchema = z.object({
  groupKey: z.string().min(1),
  groupLabel: z.string().min(1),
  choices: z.array(z.string().min(1)),
});
export type SelectedOption = z.infer<typeof SelectedOptionSchema>;

export const OrderLineSchema = z.object({
  /** Stable identity for a product plus a specific option selection. */
  key: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  imageKey: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCents: z.number().int().nonnegative(),
  options: z.array(SelectedOptionSchema),
});
export type OrderLine = z.infer<typeof OrderLineSchema>;

export const OrderTotalsSchema = z.object({
  subtotalCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  deliveryCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});
export type OrderTotals = z.infer<typeof OrderTotalsSchema>;

const SA_MOBILE = /^(?:\+?27|0)[6-8][0-9]{8}$/;

export const CustomerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.email('Enter a valid email address'),
  mobile: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s()-]/g, ''))
    .refine((value) => SA_MOBILE.test(value), 'Enter a South African mobile number'),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CreateOrderRequestSchema = z
  .object({
    storeId: z.string().min(1),
    mode: ServiceModeSchema,
    customer: CustomerSchema,
    lines: z.array(OrderLineSchema).min(1, 'Your basket is empty'),
    promoCode: z.string().min(1).nullable().default(null),
    /** Required for delivery, absent otherwise. Enforced by the refinement below. */
    address: z.string().trim().min(1).optional(),
    suburb: z.string().trim().min(1).optional(),
    /**
     * Four digits, which is every South African postal code.
     *
     * Optional on the request and required for delivery by the refinement
     * below, the same way the address and suburb are. It exists because a
     * courier needs a complete address: the Uber Direct adapter was built
     * sending an empty postal code and refusing rather than inventing one, and
     * this is the half of that gap that belongs to the checkout form.
     */
    postalCode: z.string().trim().regex(/^\d{4}$/, 'Enter a four-digit postal code').optional(),
    kitchenNote: z.string().trim().max(280).default(''),
  })
  .refine(
    (order) =>
      order.mode !== 'Delivery' || (!!order.address && !!order.suburb && !!order.postalCode),
    {
      message: 'A delivery order needs a street address, suburb and postal code',
      path: ['address'],
    },
  );
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const OrderSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().min(1),
  storeId: z.string().min(1),
  mode: ServiceModeSchema,
  status: OrderStatusSchema,
  /**
   * Who placed it. Collected and validated at checkout since the beginning and
   * then dropped on the floor: the order carried lines, totals and an address,
   * and no way for a kitchen to ring the person whose food was going cold.
   */
  customer: CustomerSchema,
  /**
   * The account it belongs to, or null for a guest.
   *
   * Nullable rather than required because ordering without an account stays
   * possible — a customer who wants chicken should not first have to want a
   * relationship — and because erasure clears this field and leaves the sale.
   */
  accountId: z.string().min(1).nullable().default(null),
  cancelledReason: z.string().min(1).nullable().default(null),
  placedAt: z.string().min(1),
  etaMinutes: z.number().int().positive(),
  lines: z.array(OrderLineSchema),
  totals: OrderTotalsSchema,
  promoCode: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  /**
   * The suburb, kept rather than only checked.
   *
   * It was collected at checkout, used to decide whether the chosen store
   * delivers there, and then dropped — the same way the customer was. A courier
   * cannot be dispatched to a street address with no suburb, and the first time
   * anybody noticed would have been the first real delivery.
   */
  suburb: z.string().min(1).nullable().default(null),
  /** Four digits for a delivery, null otherwise. What completes the address. */
  postalCode: z.string().regex(/^\d{4}$/).nullable().default(null),
  kitchenNote: z.string(),
  pointsEarned: z.number().int().nonnegative(),
});
export type Order = z.infer<typeof OrderSchema>;

/** The states an order of this mode actually passes through. */
export function statesForMode(mode: z.infer<typeof ServiceModeSchema>): OrderState[] {
  return mode === 'Delivery'
    ? [...ORDER_STATES]
    : ORDER_STATES.filter((state) => state !== 'out_for_delivery');
}

/** Delivered, Collected or Served, depending on how the order is being fulfilled. */
export function completedLabel(mode: z.infer<typeof ServiceModeSchema>): string {
  if (mode === 'Delivery') return 'Delivered';
  return mode === 'Collection' ? 'Collected' : 'Served';
}
