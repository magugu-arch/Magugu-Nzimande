/**
 * GENERATED FILE — do not edit.
 *
 * Written by scripts/generate-asset-registry.mjs from the masters present in
 * assets/food/masters/. Run `npm run assets:derive` after adding artwork.
 *
 * Metro needs static `require()` literals, which is why this is generated
 * rather than built from a loop at runtime.
 */
import type { FoodAsset, FoodAssetKey } from './foodAssets';

/** Products with their own supplied bb.q photography. */
export const suppliedFoodAssets: Partial<Record<FoodAssetKey, FoodAsset>> = {
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
