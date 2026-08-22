import type { ImageSourcePropType } from 'react-native';

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
 * ── Adding a supplied asset ────────────────────────────────────────────────
 *   1. Drop the master into assets/food/masters/<kebab-key>.jpg
 *   2. Run `npm run assets:derive`
 *   3. Move the key from PENDING_ASSET_KEYS into `foodAssets` below
 * No screen code changes.
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
 * Supplied high-resolution bb.q Chicken assets.
 *
 * `require` paths must be static literals — Metro resolves them at build time,
 * so this map cannot be generated from a loop.
 */
export const foodAssets: Partial<Record<FoodAssetKey, FoodAsset>> = {
  goldenOriginal: {
    thumb: require('@assets/food/thumb/golden-original.jpg'),
    card: require('@assets/food/card/golden-original.jpg'),
    detail: require('@assets/food/detail/golden-original.jpg'),
    banner: require('@assets/food/banner/golden-original.jpg'),
  },
  honeyGarlic: {
    thumb: require('@assets/food/thumb/honey-garlic.jpg'),
    card: require('@assets/food/card/honey-garlic.jpg'),
    detail: require('@assets/food/detail/honey-garlic.jpg'),
    banner: require('@assets/food/banner/honey-garlic.jpg'),
  },
  soyGarlic: {
    thumb: require('@assets/food/thumb/soy-garlic.jpg'),
    card: require('@assets/food/card/soy-garlic.jpg'),
    detail: require('@assets/food/detail/soy-garlic.jpg'),
    banner: require('@assets/food/banner/soy-garlic.jpg'),
  },
  hotSpicy: {
    thumb: require('@assets/food/thumb/hot-spicy.jpg'),
    card: require('@assets/food/card/hot-spicy.jpg'),
    detail: require('@assets/food/detail/hot-spicy.jpg'),
    banner: require('@assets/food/banner/hot-spicy.jpg'),
  },
};

/**
 * Products still awaiting supplied bb.q artwork.
 *
 * These render the branded <FoodImagePlaceholder> — a bb.q Black/Red tile with
 * the product name. It is deliberately NOT stock food photography: the brief
 * forbids generic or placeholder food imagery in production UI, so an obviously
 * non-photographic brand tile is the only compliant stand-in until the real
 * masters land. `npm run assets:audit` fails the build while this list is
 * non-empty, so nothing ships half-dressed by accident.
 */
export const PENDING_ASSET_KEYS: readonly FoodAssetKey[] = FOOD_ASSET_KEYS.filter(
  (key) => foodAssets[key] === undefined,
);

export function hasFoodAsset(key: FoodAssetKey): boolean {
  return foodAssets[key] !== undefined;
}

/** Resolve one derivative, or `null` when the asset has not been supplied yet. */
export function resolveFoodAsset(
  key: FoodAssetKey,
  variant: ImageVariant,
): ImageSourcePropType | null {
  const asset = foodAssets[key];
  if (!asset) return null;
  return asset[variant];
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
