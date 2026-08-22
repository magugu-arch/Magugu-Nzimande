import { colors } from './colors';
import { typography } from './typography';
import { spacing, radius, elevation, aspect } from './layout';

export { colors, type Colors } from './colors';
export {
  typography,
  fontFamily,
  fontWeight,
  headingGap,
  type TypographyVariant,
} from './typography';
export {
  spacing,
  radius,
  elevation,
  aspect,
  absoluteFill,
  HIT_SLOP,
  MIN_TOUCH_TARGET,
  CART_BAR_HEIGHT,
  TAB_BAR_HEIGHT,
} from './layout';

/** Single object for consumers that want the whole token set. */
export const theme = { colors, typography, spacing, radius, elevation, aspect } as const;

export type Theme = typeof theme;
