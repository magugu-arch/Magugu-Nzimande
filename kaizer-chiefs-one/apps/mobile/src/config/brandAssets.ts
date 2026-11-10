import type { ImageSourcePropType } from 'react-native';

/**
 * Official, club-supplied brand artwork. Empty on purpose.
 *
 * The crest, wordmark, kit marks and sponsor logos may only come from files
 * supplied by an authorised club representative. When they arrive:
 *
 *   1. Put the approved files in assets/brand/official/ (vector or @3x PNG).
 *   2. Point the entries below at them, e.g.
 *        crest: require('../../assets/brand/official/crest.png'),
 *   3. Record who supplied them and when in docs/brand-assets.md.
 *
 * Until then every <CrestSlot> renders a neutral placeholder.
 */
export const brandAssets: { crest: ImageSourcePropType | null } = {
  crest: null,
};
