import type { ImageSourcePropType } from 'react-native';
import { suppliedFoodAssets } from './foodAssetRegistry';

/**
 * Central bb.q Chicken food asset catalogue (brief §8 / §14).
 *
 * Every food image in the app resolves through this module. Screens never
 * `require()` an image directly — they pass a `FoodAssetKey` to <FoodImage>,
 * which picks the right derivative for the surface it is rendering on.
 *
 * Derivatives are produced by `npm run assets:derive` from the masters in
 * assets/food/masters/. Masters are deliberately NOT reachable from this map:
 * list screens must never load a 1122px master (brief §15).
 *
 *   thumb   1:1   400px   menu rows, cart lines, reorder chips
 *   card    4:5   800px   catalogue cards, best sellers, category tiles
 *   detail  4:5  1200px   product detail hero
 *   banner 16:9  1600px   home promotions, offer banners
 *
 * ── Adding supplied artwork ────────────────────────────────────────────────
 *   1. Drop the master into assets/food/masters/<kebab-key>.jpg
 *   2. Run `npm run assets:derive`
 * That regenerates the crops and the static require() registry. No hand-editing
 * and no screen changes — the product stops substituting on the next build.
 */

/** The 16 products the brief requires artwork for. */
export const FOOD_ASSET_KEYS = [
  'goldenOriginal',
  'honeyGarlic',
  'soyGarlic',
  'secretSauce',
  'hotSpicy',
  'cheesling',
  'goldenOriginalWings',
  'boneless',
  'halfAndHalf',
  'chickenRiceMeal',
  'chickenBurger',
  'koreanRiceBowl',
  'frenchFries',
  'cheeslingFries',
  'ddeokBokki',
  'roseDdeokBokki',
] as const;

export type FoodAssetKey = (typeof FOOD_ASSET_KEYS)[number];

export type ImageVariant = 'thumb' | 'card' | 'detail' | 'banner';

export interface FoodAsset {
  thumb: ImageSourcePropType;
  card: ImageSourcePropType;
  detail: ImageSourcePropType;
  banner: ImageSourcePropType;
}

/**
 * Products with their own supplied photography, from the generated registry.
 * `hasFoodAsset` reports against this — not against the substitution below.
 */
export const foodAssets = suppliedFoodAssets;

/**
 * Stand-in photography for products whose own shoot has not landed yet.
 *
 * Each pending product borrows the closest supplied asset in the same food
 * family, so the menu reads as finished rather than half-built. Two caveats
 * worth keeping in view:
 *
 *  - A borrowed photo shows a different product. Anything substituted is
 *    flagged `isSubstituted`, and the product detail screen captions it
 *    "Serving suggestion" so a customer inspecting the item closely is not
 *    told it is something it is not.
 *  - `npm run assets:audit` still counts these as outstanding. Substitution
 *    changes what a customer sees, not what the shoot list owes.
 *
 * Mapping is by visual family, not by menu section: glaze colour and finish are
 * what a customer actually reads in a thumbnail.
 */
export const SUBSTITUTE_ASSET_KEYS: Partial<Record<FoodAssetKey, FoodAssetKey>> = {
  // Whole crispy pieces, unglazed — reads as "fried chicken on a plate".
  chickenRiceMeal: 'goldenOriginal',
  chickenBurger: 'goldenOriginal',
  // Dark, glossy lacquered glaze over rice.
  koreanRiceBowl: 'soyGarlic',
  // Bite-size golden fried pieces in a tray sit far closer to a fries portion
  // than a whole drumstick does.
  frenchFries: 'boneless',
  // Same cheese dusting, so the seasoning itself is accurate.
  cheeslingFries: 'cheesling',
  // Glossy red chilli sauce with fresh chilli — the closest thing we have to
  // a saucy rice-cake dish.
  ddeokBokki: 'secretSauce',
  roseDdeokBokki: 'secretSauce',
};

/**
 * Products still awaiting their own supplied bb.q artwork.
 *
 * `npm run assets:audit` fails the build while this list is non-empty, so the
 * outstanding shoot list stays visible even though the UI now substitutes.
 */
export const PENDING_ASSET_KEYS: readonly FoodAssetKey[] = FOOD_ASSET_KEYS.filter(
  (key) => foodAssets[key] === undefined,
);

/** True only when the product has its OWN photography. */
export function hasFoodAsset(key: FoodAssetKey): boolean {
  return foodAssets[key] !== undefined;
}

/** True when the product is borrowing another product's photograph. */
export function isSubstituted(key: FoodAssetKey): boolean {
  return !hasFoodAsset(key) && resolveSubstitute(key) !== null;
}

/** The key actually rendered for a product: itself, or its stand-in. */
export function resolveSubstitute(key: FoodAssetKey): FoodAssetKey | null {
  if (foodAssets[key]) return key;
  const substitute = SUBSTITUTE_ASSET_KEYS[key];
  return substitute && foodAssets[substitute] ? substitute : null;
}

/**
 * Resolve one derivative. Falls back to the substitute photograph, and returns
 * `null` only when neither the product nor its stand-in has artwork — in which
 * case the branded placeholder tile renders instead.
 */
export function resolveFoodAsset(
  key: FoodAssetKey,
  variant: ImageVariant,
): ImageSourcePropType | null {
  const resolved = resolveSubstitute(key);
  if (!resolved) return null;
  return foodAssets[resolved]?.[variant] ?? null;
}

/** Human-readable product names, used by the placeholder tile and alt text. */
export const FOOD_ASSET_LABELS: Record<FoodAssetKey, string> = {
  goldenOriginal: 'Golden Original Chicken',
  honeyGarlic: 'Honey Garlic Chicken',
  soyGarlic: 'Soy Garlic Chicken',
  secretSauce: 'Secret Sauce Chicken',
  hotSpicy: 'Hot Spicy Chicken',
  cheesling: 'Cheesling Chicken',
  goldenOriginalWings: 'Golden Original Wings',
  boneless: 'Boneless Chicken',
  halfAndHalf: 'Half & Half Chicken',
  chickenRiceMeal: 'Chicken & Rice Meal',
  chickenBurger: 'Chicken Burger',
  koreanRiceBowl: 'Korean Rice Bowl',
  frenchFries: 'French Fries',
  cheeslingFries: 'Cheesling Fries',
  ddeokBokki: 'Ddeok-Bokki',
  roseDdeokBokki: 'Rose Ddeok-Bokki',
};

/** Filename stem the derivative pipeline expects for each key. */
export const FOOD_ASSET_FILENAMES: Record<FoodAssetKey, string> = {
  goldenOriginal: 'golden-original',
  honeyGarlic: 'honey-garlic',
  soyGarlic: 'soy-garlic',
  secretSauce: 'secret-sauce',
  hotSpicy: 'hot-spicy',
  cheesling: 'cheesling',
  goldenOriginalWings: 'golden-original-wings',
  boneless: 'boneless',
  halfAndHalf: 'half-and-half',
  chickenRiceMeal: 'chicken-rice-meal',
  chickenBurger: 'chicken-burger',
  koreanRiceBowl: 'korean-rice-bowl',
  frenchFries: 'french-fries',
  cheeslingFries: 'cheesling-fries',
  ddeokBokki: 'ddeok-bokki',
  roseDdeokBokki: 'rose-ddeok-bokki',
};
