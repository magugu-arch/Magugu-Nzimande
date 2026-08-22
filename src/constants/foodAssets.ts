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
 * **Empty, and it should stay that way.** All 16 catalogue products now carry
 * their own supplied bb.q photograph, so nothing borrows and nothing renders
 * the placeholder tile.
 *
 * The mechanism is kept for the next product added to the menu ahead of its
 * shoot. Map the new key to the closest supplied asset by visual family —
 * glaze colour and finish, not menu section, since that is what a customer
 * reads in a thumbnail. Anything mapped here is flagged by `isSubstituted`
 * and captioned "Serving suggestion" on the product detail screen, and still
 * counts as outstanding in `npm run assets:audit`: substitution changes what
 * a customer sees, not what the shoot list owes.
 */
export const SUBSTITUTE_ASSET_KEYS: Partial<Record<FoodAssetKey, FoodAssetKey>> = {};

/**
 * Products still awaiting their own supplied bb.q artwork. Currently empty.
 *
 * `npm run assets:audit` fails the build while this list is non-empty, so a
 * product added to the menu without a photograph cannot ship unnoticed.
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
