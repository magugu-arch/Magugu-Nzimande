import type { FoodAssetKey } from '@/constants/foodAssets';

/** Menu taxonomy from brief §10. */
export type CategoryId = 'chicken' | 'meals' | 'sides' | 'drinks' | 'desserts';

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
  | 'bestseller'
  | 'new'
  | 'spicy'
  | 'popular'
  | 'value'
  | 'sharing'
  | 'boneless';

export interface MenuSnapshot {
  categories: Category[];
  products: Product[];
  updatedAt: string;
}
