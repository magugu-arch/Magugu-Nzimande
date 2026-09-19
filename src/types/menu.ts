import type { FoodAssetKey } from '@/constants/foodAssets';

/**
 * The Pappas menu taxonomy.
 *
 * §17.6 lists sixteen category ids, and §10's asset map names ten of them as
 * having supplied photography: Mezedakia, Seafood, Salads, Signature Mains,
 * Souvlaki, Steak on the Rock, Fish Market, Desserts, Breakfast and Drinks.
 *
 * Those ten are what this union carries, and the reason is §15's rule against
 * inventing dishes. §17.6's other six — vegetarian, meat, dips, lightMeals,
 * steaks, fishPlatters, gelato — have no supplied imagery and, more to the
 * point, no supplied contents. A category id with nothing behind it is an
 * empty screen a customer can navigate into, which is worse than a menu that
 * does not claim to be complete.
 *
 * Adding one back is a pure data change once Pappas supplies its contents:
 * the id joins this union, the category joins `categories`, and its dishes
 * join the catalogue. Nothing else moves.
 */
export type CategoryId =
  | 'mezedakia'
  | 'salads'
  | 'souvlaki'
  | 'seafood'
  | 'fish-market'
  | 'signature-mains'
  | 'steak-on-the-rock'
  | 'breakfast'
  | 'desserts'
  | 'drinks';

export type SpiceLevel = 0 | 1 | 2 | 3;

export interface Category {
  id: CategoryId;
  name: string;
  tagline: string;
  /** Asset used for the category tile. */
  assetKey: FoodAssetKey;
  sortOrder: number;
}

/** A choice inside an option group (e.g. "Large", "Soy Garlic"). */
export interface ProductOption {
  id: string;
  name: string;
  /** Delta applied to the base price, in ZAR. May be negative. */
  priceDelta: number;
  description?: string;
  available: boolean;
  /** Optional imagery for flavour/sauce pickers. */
  assetKey?: FoodAssetKey;
}

export type OptionGroupKind = 'size' | 'flavour' | 'addon' | 'side' | 'drink';

export interface OptionGroup {
  id: string;
  name: string;
  kind: OptionGroupKind;
  /** Minimum selections required before the item can be added to cart. */
  minSelect: number;
  /** Maximum selections allowed. 1 = radio behaviour, >1 = checkbox. */
  maxSelect: number;
  options: ProductOption[];
  /** Pre-selected option ids when the customiser first opens. */
  defaultOptionIds: string[];
}

export interface NutritionInfo {
  kilojoules: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Whether a dish's price is a real Pappas price.
 *
 * `confirmed` is the ordinary case once Pappas supplies its menu pricing.
 * `awaiting-business-input` says nobody has told us yet — see
 * `data/businessInput.ts` for why this is a state and not a zero.
 *
 * A dish awaiting a price carries `basePrice: 0` and `available: false`, so
 * it appears on the menu, tells the customer honestly that the price is on
 * request, and cannot be added to a cart. The zero never reaches any
 * arithmetic because nothing unavailable can be ordered — that is the whole
 * reason the two flags travel together.
 */
export type PriceStatus = 'confirmed' | 'awaiting-business-input';

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  /** Base price in ZAR (rand, not cents — see money util for formatting). */
  basePrice: number;
  /**
   * Defaults to `confirmed` when absent, so every existing caller is
   * unchanged and only a dish that says otherwise is treated as unpriced.
   */
  priceStatus?: PriceStatus;
  categoryId: CategoryId;
  assetKey: FoodAssetKey;
  spiceLevel: SpiceLevel;
  tags: ProductTag[];
  optionGroups: OptionGroup[];
  /** Product ids surfaced as "goes well with" on the detail screen. */
  recommendedProductIds: string[];
  available: boolean;
  preparationMinutes: number;
  serves: string;
  allergens: string[];
  nutrition?: NutritionInfo;
}

/**
 * §6: "Add 'Chef / Pappas favourites', seasonal or best-seller labels only
 * when backed by business data."
 *
 * So `bestseller`, `popular` and `chefs-choice` are in the type but unused in
 * the shipped catalogue — no sales data exists to back a single one of them,
 * and a best-seller badge chosen by whoever wrote the seed file is a
 * fabricated business claim. `vegetarian` and `sharing` are different: both
 * are observable from the dish itself.
 */
export type ProductTag =
  | 'bestseller'
  | 'new'
  | 'popular'
  | 'chefs-choice'
  | 'seasonal'
  | 'vegetarian'
  | 'sharing'
  | 'signature';

export interface MenuSnapshot {
  categories: Category[];
  products: Product[];
  updatedAt: string;
}
