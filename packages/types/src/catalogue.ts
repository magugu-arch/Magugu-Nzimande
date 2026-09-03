import { z } from 'zod';

/**
 * Schemas are the contract between the API and every client. Responses are
 * parsed through them, never cast.
 */

export const CategoryKeySchema = z.enum(['Chicken', 'Wings', 'Meals', 'Sides', 'Kids']);
export type CategoryKey = z.infer<typeof CategoryKeySchema>;

export const CategorySchema = z.object({
  key: CategoryKeySchema,
  label: z.string().min(1),
  note: z.string().min(1),
});
export type Category = z.infer<typeof CategorySchema>;

/** 0 is unspiced. The ladder runs to 5 and is rendered as the heat meter. */
export const HeatSchema = z.number().int().min(0).max(5);

export const OptionChoiceSchema = z.object({
  label: z.string().min(1),
  /** Signed cents added to the line unit price. Negative for a smaller portion. */
  deltaCents: z.number().int(),
});
export type OptionChoice = z.infer<typeof OptionChoiceSchema>;

export const OptionGroupSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  choices: z.array(OptionChoiceSchema).min(1),
  /** A multi group accepts any number of choices; otherwise exactly one. */
  multi: z.boolean().default(false),
  /** Index of the choice selected when the product screen opens. */
  defaultIndex: z.number().int().min(0).default(0),
});
export type OptionGroup = z.infer<typeof OptionGroupSchema>;

export const NutritionSchema = z.object({
  allergens: z.string().min(1),
  kilojoules: z.number().int().positive(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

export const ProductSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  category: CategoryKeySchema,
  priceCents: z.number().int().nonnegative(),
  heat: HeatSchema,
  sauce: z.string().min(1),
  tag: z.string().min(1).optional(),
  description: z.string().min(1),
  imageKey: z.string().min(1),
  nutrition: NutritionSchema,
  /**
   * Sold out and hidden are different states. A sold-out product is returned by
   * the catalogue and blocked in the interface; a hidden product is absent from
   * the catalogue response entirely.
   */
  soldOut: z.boolean().default(false),
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductWithOptionsSchema = ProductSchema.extend({
  optionGroups: z.array(OptionGroupSchema),
});
export type ProductWithOptions = z.infer<typeof ProductWithOptionsSchema>;

export const SauceSchema = z.object({
  name: z.string().min(1),
  heat: HeatSchema,
  note: z.string().min(1),
});
export type Sauce = z.infer<typeof SauceSchema>;

export const FaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});
export type Faq = z.infer<typeof FaqSchema>;
