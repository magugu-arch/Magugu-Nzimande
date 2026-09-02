import type { FoodAssetKey } from '@/constants/foodAssets';

/**
 * The menu taxonomy, exactly as the brief sets it out.
 *
 * §8 ("Chicken / Wings / Boneless / Meals / Burgers / Rice Bowls / Sides /
 * Drinks / Sauces & Extras") and §17 ("Required product categories: …") list
 * these nine and agree with each other. The master prompt merges the second
 * and third into one "Wings & Boneless"; two references to one, and separate
 * is also the shape the wider menu slots into, so they stay separate here.
 *
 * `desserts` used to be in this union and is in none of the three lists — it
 * has been dropped rather than carried as a category nothing can ever fill.
 *
 * All nine are typed, but only the seven with supplied products are surfaced
 * in `categories` — see the note there for why Drinks and Sauces & Extras are
 * held back. Typing them keeps the taxonomy whole and makes promoting either
 * one a pure data change once its photography lands.
 */
export type CategoryId =
  | 'chicken'
  | 'wings'
  | 'boneless'
  | 'meals'
  | 'burgers'
  | 'rice-bowls'
  | 'sides'
  | 'drinks'
  | 'sauces-extras'
  /**
   * Kids Menu, added by the kids-menu brief. Unlike Drinks and Sauces &
   * Extras it arrived with both its products and its photography, so it is
   * surfaced in `categories` from the start rather than held back.
   */
  | 'kids';

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

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  /** Base price in ZAR (rand, not cents — see money util for formatting). */
  basePrice: number;
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

export type ProductTag =
  'bestseller' | 'new' | 'spicy' | 'popular' | 'value' | 'sharing' | 'boneless';

export interface MenuSnapshot {
  categories: Category[];
  products: Product[];
  updatedAt: string;
}
