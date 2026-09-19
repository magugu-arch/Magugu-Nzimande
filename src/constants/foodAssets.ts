import type { ImageSourcePropType } from 'react-native';
import {
  PAPPAS_ASSET_KEYS,
  pappasAsset,
  pappasAssetDescription,
  type PappasAssetKey,
} from '@/data/pappasAssets';

/**
 * The app's food-imagery surface, pointed at the Pappas photography.
 *
 * Every food image in the app resolves through this module. Screens never
 * `require()` an image directly — they pass a key to `<FoodImage>`, which
 * picks the derivative for the surface it is rendering on.
 *
 * ── Why this file is a thin adapter now ──────────────────────────────────
 *
 * The photography registry itself lives in `data/pappasAssets.ts`, matching
 * §17.5's structure. This module stays because a great deal of the app
 * already speaks its vocabulary — `FoodAssetKey`, `ImageVariant`,
 * `resolveFoodAsset`, `<FoodImage>` — and §13's "do not regress existing
 * functional tests" plus §17.1's "keep the current framework and
 * architecture" both point the same way: re-point the existing seam rather
 * than rewrite thirty call sites to say the same thing differently.
 *
 * The one vocabulary change that could not be avoided: the Pappas pipeline
 * cuts a `hero` at 4:3 where the old one cut a `detail` at 4:5. §5 asks for
 * "one large, editorial food or venue image", and 4:5 on a phone is a
 * portrait box rather than an editorial frame. `detail` is mapped onto
 * `hero` here so existing callers keep working and get the better crop.
 *
 * ── The substitution mechanism ───────────────────────────────────────────
 *
 * Kept, and it now does real work. The old catalogue had one photograph per
 * product. Pappas supplied thirteen photographs for a menu of more dishes
 * than that, because each one is a *category* composition — the seafood
 * poster shows prawns, mussels, oysters and calamari together. So most
 * dishes legitimately share their category's photograph, and
 * `SUBSTITUTE_ASSET_KEYS` is how a dish says which one it borrows.
 *
 * A borrowed photograph is captioned "Serving suggestion" on the detail
 * screen and counts as outstanding in `npm run assets:audit`. That is not
 * pedantry: a customer looking at a prawn platter while ordering mussels has
 * been misled, mildly, and the shoot list should know it.
 */

/** The thirteen supplied Pappas photographs. */
export const FOOD_ASSET_KEYS = PAPPAS_ASSET_KEYS;

export type FoodAssetKey = PappasAssetKey;

/**
 * `detail` is retained as an alias for `hero` so existing callers are
 * unchanged. New code should ask for `hero`.
 */
export type ImageVariant = 'thumb' | 'card' | 'detail' | 'hero' | 'banner';

export interface FoodAsset {
  thumb: ImageSourcePropType;
  card: ImageSourcePropType;
  detail: ImageSourcePropType;
  hero: ImageSourcePropType;
  banner: ImageSourcePropType;
}

const build = (key: FoodAssetKey): FoodAsset => ({
  thumb: pappasAsset(key, 'thumb'),
  card: pappasAsset(key, 'card'),
  detail: pappasAsset(key, 'hero'),
  hero: pappasAsset(key, 'hero'),
  banner: pappasAsset(key, 'banner'),
});

export const foodAssets: Record<FoodAssetKey, FoodAsset> = Object.fromEntries(
  FOOD_ASSET_KEYS.map((key) => [key, build(key)]),
) as Record<FoodAssetKey, FoodAsset>;

/**
 * Dishes that borrow their category's photograph.
 *
 * Empty: every key in this registry has its own supplied composition. The
 * mechanism matters at the *product* level instead — see `assetKey` on each
 * dish in the catalogue, where several dishes point at one category image,
 * and `isSubstituted` below.
 */
export const SUBSTITUTE_ASSET_KEYS: Partial<Record<FoodAssetKey, FoodAssetKey>> = {};

/**
 * Photography Pappas still owes.
 *
 * Empty against the thirteen supplied keys. It is not empty against the
 * *menu*: most dishes share a category composition rather than having their
 * own plate shot, which `npm run audit:placeholders` reports. §10 supplied
 * category heroes, not a dish-by-dish shoot, and the app is honest about
 * which it is showing.
 */
export const PENDING_ASSET_KEYS: readonly FoodAssetKey[] = FOOD_ASSET_KEYS.filter(
  (key) => foodAssets[key] === undefined,
);

/** True only when the key has its own supplied photograph. */
export function hasFoodAsset(key: FoodAssetKey): boolean {
  return foodAssets[key] !== undefined;
}

/** True when the key is borrowing another key's photograph. */
export function isSubstituted(key: FoodAssetKey): boolean {
  return !hasFoodAsset(key) && resolveSubstitute(key) !== null;
}

/** The key actually rendered: itself, or its stand-in. */
export function resolveSubstitute(key: FoodAssetKey): FoodAssetKey | null {
  if (foodAssets[key]) return key;
  const substitute = SUBSTITUTE_ASSET_KEYS[key];
  return substitute && foodAssets[substitute] ? substitute : null;
}

/**
 * Resolve one derivative. Returns `null` only when neither the key nor its
 * stand-in has artwork — in which case the branded placeholder tile renders.
 */
export function resolveFoodAsset(
  key: FoodAssetKey,
  variant: ImageVariant,
): ImageSourcePropType | null {
  const resolved = resolveSubstitute(key);
  if (!resolved) return null;
  return foodAssets[resolved]?.[variant] ?? null;
}

/**
 * What each photograph shows.
 *
 * Descriptions of the image, not repetitions of the heading printed beside
 * it — §13 asks for accessible labels, and a screen reader that says
 * "Mezedakia. Mezedakia." has been given two labels and no information.
 */
export const FOOD_ASSET_LABELS: Record<FoodAssetKey, string> = Object.fromEntries(
  FOOD_ASSET_KEYS.map((key) => [key, pappasAssetDescription(key)]),
) as Record<FoodAssetKey, string>;

/** Filename stem the derivative pipeline writes for each key. */
export const FOOD_ASSET_FILENAMES: Record<FoodAssetKey, string> = {
  mezedakia: '03_mezedakia',
  seafood: '04_seafood',
  salads: '05_salads',
  signatureMains: '06_signature_mains',
  souvlaki: '07_souvlaki',
  steakOnRock: '08_steak_on_the_rock',
  fishMarket: '09_mediterranean_fish_market',
  desserts: '10_desserts',
  breakfast: '11_breakfast',
  cocktails: '12_cocktails',
  diningRoom: '13_main_dining_room',
  barDetail: '14_bar_detail',
  squareView: '16_window_square_view',
};
