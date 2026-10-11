import type { ImageSourcePropType } from 'react-native';

export type AssetCategory = 'product' | 'product-on-model' | 'editorial' | 'accessory' | 'event';

export type AssetPlacement =
  | 'home-hero'
  | 'home'
  | 'onboarding'
  | 'catalogue-card'
  | 'pdp-primary'
  | 'pdp-gallery'
  | 'discover'
  | 'events-hero';

/**
 * One of the 24 verified concept images, or an addition the manifest records
 * with who supplied it and why. `conceptAsset` stays true until MAXHOSA
 * approves the image for production; the UI labels it while it is.
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
  /** Present only on images outside the verified 24, recorded when they were added. */
  addition?: { suppliedBy: string; date: string; purpose: string; approval: string };
};
