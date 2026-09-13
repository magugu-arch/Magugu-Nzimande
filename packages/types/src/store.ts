import { z } from 'zod';

export const ServiceModeSchema = z.enum(['Delivery', 'Collection', 'Dine-in']);
export type ServiceMode = z.infer<typeof ServiceModeSchema>;

export const SERVICE_MODES: readonly ServiceMode[] = ['Delivery', 'Collection', 'Dine-in'];

export const TradingHoursSchema = z.object({
  /** Minutes past midnight, so trading status is a comparison rather than a parse. */
  opensMinute: z.number().int().min(0).max(1439),
  closesMinute: z.number().int().min(0).max(1439),
  label: z.string().min(1),
});
export type TradingHours = z.infer<typeof TradingHoursSchema>;

export const StoreSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  telephone: z.string().min(1),
  hours: TradingHoursSchema,
  distanceKm: z.number().nonnegative(),
  services: z.record(ServiceModeSchema, z.boolean()),
  /** Suburbs this store delivers to. Compared case-insensitively. */
  zones: z.array(z.string().min(1)),
  halaal: z.string().min(1),
});
export type Store = z.infer<typeof StoreSchema>;

/**
 * The conditions an offer carries, in a form the checkout can check.
 *
 * `validity` beside it is the same rule as a sentence for a customer to read.
 * It was the only form the rule existed in, and nothing enforced it: an offer
 * advertised as "Every Wednesday, 11:00 to close" took its discount at any hour
 * on any day, and one advertised "collection only" worked on a delivery.
 *
 * Nothing here is invented. Every field encodes a condition the offer's own
 * `validity` line already states; a condition that is not stated is left open,
 * and one that cannot be checked online — a student card shown at the counter —
 * stays in the sentence for the person at the till.
 */
export const PromotionWindowSchema = z.object({
  /**
   * Days it runs, as SAST weekdays with 0 for Sunday. Empty means every day.
   * Not a date range: these are recurring weekly offers, and a range would
   * expire them silently.
   */
  days: z.array(z.number().int().min(0).max(6)).default([]),
  /** Minutes past midnight SAST. Null means the offer has no bound that end. */
  fromMinute: z.number().int().min(0).max(1_439).nullable().default(null),
  toMinute: z.number().int().min(0).max(1_440).nullable().default(null),
  /** Fulfilment modes it runs on. Empty means all of them. */
  modes: z.array(ServiceModeSchema).default([]),
});
export type PromotionWindow = z.infer<typeof PromotionWindowSchema>;

export const PromotionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /**
   * The item the offer is on. The discount comes off this product's lines, not
   * off the whole basket: "twenty percent off every sauced wing" is not twenty
   * percent off the chicken and the drinks in the same order.
   */
  productSlug: z.string().min(1),
  code: z.string().min(1),
  /** Fraction of the named product's lines removed, between 0 and 1. */
  discountRate: z.number().min(0).max(1),
  /** The conditions as a sentence, for the customer. */
  validity: z.string().min(1),
  /** The same conditions, for the checkout. */
  window: PromotionWindowSchema.default({ days: [], fromMinute: null, toMinute: null, modes: [] }),
  /**
   * Restricted to a signed-in account's first order, as "New accounts, one
   * use" states. A guest cannot use one: there is no way to tell whether it is
   * their first.
   */
  firstOrderOnly: z.boolean().default(false),
  copy: z.string().min(1),
});
export type Promotion = z.infer<typeof PromotionSchema>;

export const RewardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  points: z.number().int().positive(),
});
export type Reward = z.infer<typeof RewardSchema>;

export const DeliveryQuoteRequestSchema = z.object({
  suburb: z.string().min(1, 'Enter your suburb'),
  /**
   * Carries a message like every other rule here, even though no customer
   * types it.
   *
   * The basket computes this, so a bad one is our bug rather than theirs — but
   * it still arrives on their screen, and the route that serves this schema
   * answers with the message of whichever rule was broken. A rule with no
   * message of its own falls back to the validator's, which says "expected
   * number, received string" to somebody trying to order dinner.
   */
  subtotalCents: z
    .number('We could not read your basket total')
    .int('We could not read your basket total')
    .nonnegative('We could not read your basket total'),
  /**
   * Which branch is being ordered from.
   *
   * Optional, and that is the whole shape of the fix. Without it the endpoint
   * answers "does anybody deliver to this suburb", which is what the stores
   * page wants to know. Checkout needs the narrower question — "will the branch
   * in this basket deliver to it" — and was asking the wide one, so a customer
   * with Cresta selected who typed a Fourways address was told yes and refused
   * at placement by the order route, which had always asked the narrow one.
   */
  storeId: z.string().min(1, 'Name the branch to quote for').optional(),
});
export type DeliveryQuoteRequest = z.infer<typeof DeliveryQuoteRequestSchema>;

export const DeliveryQuoteSchema = z.discriminatedUnion('serviceable', [
  z.object({
    serviceable: z.literal(true),
    feeCents: z.number().int().nonnegative(),
    etaMinutes: z.number().int().positive(),
    storeId: z.string().min(1),
  }),
  z.object({
    serviceable: z.literal(false),
    reason: z.string().min(1),
    /**
     * A branch that does deliver there, when the one asked about does not.
     *
     * The difference between losing the sale and moving it one branch across.
     * "We do not deliver to this suburb yet" is simply false when another
     * branch covers it, and a customer told that closes the tab.
     *
     * Absent rather than null when nobody covers it, so a screen offering the
     * switch has one thing to check.
     */
    alternativeStoreId: z.string().min(1).optional(),
  }),
]);
export type DeliveryQuote = z.infer<typeof DeliveryQuoteSchema>;
