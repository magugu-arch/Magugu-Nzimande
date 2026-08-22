import { Platform, type ViewStyle } from 'react-native';

/**
 * 4pt spacing scale.
 *
 * The three values guidelines §23.7 names are aliased below with the meaning
 * the diagram gives them, so layout code can say what it is doing rather than
 * pick a t-shirt size and hope it was the right one.
 */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,

  /** §23.7: 24px, the padding between screen edge and content. */
  gutter: 24,
  /** §23.7: 16px, the gap between elements inside a card or row. */
  gap: 16,
  /** §23.7: 4px, the tightest gap — label to value, icon to text. */
  gapTight: 4,
} as const;

/** bb.q Black. Repeated here because layout must not import colours. */
const SHADOW_INK = '#221E1F';

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

/**
 * Minimum interactive target. WCAG 2.5.5 / platform HIG both land near 44pt —
 * every pressable in the app must clear this.
 */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH_TARGET = 44;

/** Aspect ratios matched to the derivative pipeline in scripts/. */
export const aspect = {
  thumb: 1,
  card: 4 / 5,
  detail: 4 / 5,
  banner: 16 / 9,
  wide: 3 / 2,
} as const;

export const elevation = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: SHADOW_INK,
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    default: { elevation: 2 },
  }) as ViewStyle,
  md: Platform.select({
    ios: {
      shadowColor: SHADOW_INK,
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    default: { elevation: 4 },
  }) as ViewStyle,
  lg: Platform.select({
    ios: {
      shadowColor: SHADOW_INK,
      shadowOpacity: 0.16,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    default: { elevation: 8 },
  }) as ViewStyle,
} as const;

/**
 * Absolute-fill style object.
 *
 * `StyleSheet.absoluteFill` is a registered style ID, so it cannot be spread
 * into a `StyleSheet.create` entry. This is the spreadable equivalent.
 */
export const absoluteFill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const satisfies ViewStyle;

/** Height of the sticky cart bar, so scroll views can pad for it. */
export const CART_BAR_HEIGHT = 64;
export const TAB_BAR_HEIGHT = 60;
