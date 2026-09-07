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

/**
 * How many of one thing, and how many things, an order may carry.
 *
 * These are arithmetic bounds before they are commercial ones. Every total in
 * this application is an integer number of cents, and JavaScript numbers are
 * only exact integers below 2^53. `quantity` had no upper bound at all, so an
 * order for a trillion pieces of chicken was accepted with a 201: the total
 * came back as 18,900,000,000,000,000 cents, `Number.isSafeInteger` said false,
 * and the loyalty ledger credited 189 trillion points on completion. Nothing
 * refused it because nothing had been asked to.
 *
 * At these bounds the dearest possible basket is a few million cents, which is
 * eighteen million times inside the exact range — so the sums the customer sees
 * are the sums that were computed, with room that no menu change will consume.
 *
 * They are also deliberately conservative rather than researched: 99 of one
 * item and 50 distinct items are far past any real order from a menu of 28
 * products, and both are numbers the franchisor can raise. The test beside them
 * checks the arithmetic still holds wherever they are set, so raising one is a
 * decision somebody makes rather than a limit somebody removes.
 */
export const MAX_LINE_QUANTITY = 99;
export const MAX_BASKET_LINES = 50;

export const OrderLineSchema = z.object({
  /** Stable identity for a product plus a specific option selection. */
  key: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  imageKey: z.string().min(1),
  quantity: z
    .number()
    .int()
    .positive()
    .max(MAX_LINE_QUANTITY, `A single item is limited to ${MAX_LINE_QUANTITY}. Ring the store for a larger order.`),
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
    lines: z
      .array(OrderLineSchema)
      .min(1, 'Your basket is empty')
      .max(
        MAX_BASKET_LINES,
        `A basket holds ${MAX_BASKET_LINES} different items. Ring the store for a larger order.`,
      ),
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
  /**
   * The courier's own estimate, in minutes, or null.
   *
   * Separate from `etaMinutes`, which is the window quoted when the order was
   * placed and never moves. This one is what the driver's app says now, and it
   * arrives on the courier's webhook — which parsed it carefully and threw it
   * away, so a customer whose driver was stuck in traffic went on being told
   * the same forty-five minutes for an hour.
   *
   * Null until a courier says otherwise, which is most orders: a collection has
   * no driver, and a delivery has none until one is assigned.
   */
  courierEtaMinutes: z.number().int().nonnegative().nullable().default(null),

  /**
   * When the points actually landed on an account, or null.
   *
   * Separate from `pointsEarned`, which is what this order is worth — a
   * number known the moment it is priced. This is whether anybody has been
   * given them, and it exists because the two were being confused: points were
   * credited when the order was placed, so a signed-in customer could place an
   * order, take the points, cancel it and keep them, while the rewards page
   * promised they post on completion.
   *
   * Null for a guest's order forever. There is no account for them to land on,
   * and a guest's balance is whatever this browser remembers.
   */
  pointsPostedAt: z.string().nullable().default(null),
});
export type Order = z.infer<typeof OrderSchema>;

/**
 * The order as somebody holding nothing but its id may see it.
 *
 * The journey screen is reachable with an order id and no session, and that is
 * deliberate: a guest has no account to sign into, and a "track your order"
 * link that first demanded a password would be a link nobody could follow. It
 * makes the id the only thing standing between a stranger and whatever this
 * returns — and what it returned was the whole record. The customer's name,
 * their email address, their mobile number, and on a delivery the street they
 * live in, handed to anyone who asked with a number.
 *
 * The ids are `O-<clock>-<sequence>`, which is not a secret so much as a number
 * that is tedious to guess: the sequence is a small integer and the clock is
 * bounded by when the shop was open. But a better id would not have fixed this,
 * because the screens never wanted any of those fields. Between them they read
 * eleven, and they were being sent twenty.
 *
 * An allowlist and not a strip-list, because the two fail in opposite
 * directions. A field added to `OrderSchema` next year is missing from this
 * list and stays behind the counter until somebody adds it on purpose; a field
 * added to a list of things to remove is public from the moment it exists.
 */
export const PublicOrderSchema = OrderSchema.pick({
  id: true,
  orderNumber: true,
  mode: true,
  status: true,
  lines: true,
  totals: true,
  placedAt: true,
  etaMinutes: true,
  courierEtaMinutes: true,
  kitchenNote: true,
  pointsEarned: true,
});
export type PublicOrder = z.infer<typeof PublicOrderSchema>;

/**
 * Narrow an order to that view.
 *
 * `parse` rather than picking the fields by hand: an object literal listing ten
 * properties is a place to mistype one, and Zod drops what the schema does not
 * name. The stripping is the point, so it is done by the thing that cannot
 * forget.
 */
export function publicOrder(order: Order): PublicOrder {
  return PublicOrderSchema.parse(order);
}

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
