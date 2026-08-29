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

export const PromotionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  productSlug: z.string().min(1),
  code: z.string().min(1),
  /** Fraction of the subtotal removed, between 0 and 1. */
  discountRate: z.number().min(0).max(1),
  validity: z.string().min(1),
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
  subtotalCents: z.number().int().nonnegative(),
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
  }),
]);
export type DeliveryQuote = z.infer<typeof DeliveryQuoteSchema>;
