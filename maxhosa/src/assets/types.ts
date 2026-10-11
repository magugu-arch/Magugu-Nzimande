import type { ImageSourcePropType } from 'react-native';

export type AssetCategory = 'product' | 'product-on-model' | 'editorial' | 'accessory';

export type AssetPlacement =
  | 'home-hero'
  | 'onboarding'
  | 'catalogue-card'
  | 'pdp-primary'
  | 'pdp-gallery'
  | 'discover';

/**
 * One of the 24 verified concept images. `conceptAsset` stays true until
 * MAXHOSA approves the image for production; the UI labels it while it is.
 */
export type AssetRecord = {
  id: string;
  source: ImageSourcePropType;
  title: string;
  alt: string;
  category: AssetCategory;
  placement: readonly AssetPlacement[];
  width: number;
  height: number;
  conceptAsset: true;
};
