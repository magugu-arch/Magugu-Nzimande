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

  /**
   * §23.7: 24px, the padding between screen edge and content. The section's
   * other two values need no alias — its 16px inner gap is `lg` and its 4px
   * tight gap is `xs`, and a second name for the same number invites drift.
   */
  gutter: 24,
} as const;

/** Pappas Charcoal. Repeated here because layout must not import colours. */
const SHADOW_INK = '#1A1A1A';

/**
 * Corner radii — brief §12's "restrained corner-radius system".
 *
 * The values are §17.3's (sm 8, md 14, lg 20, xl 28, pill 999), which run a
 * step softer than what was here before. That is the right direction for this
 * brand: the supplied photography is all rounded ceramic, arched stone
 * doorways and curved rattan, and a 6pt corner reads as a form field beside
 * it.
 *
 * `pill` is retained but §12 restricts where it may go — "avoid excessive
 * pill-shaped UI except for tags, filter chips and small status states". A
 * pill-shaped primary button is a fast-food button, which §15's first
 * guardrail rules out; CTAs take `md`.
 */
export const radius = {
  none: 0,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 32,
  pill: 999,
} as const;

/**
 * Motion durations — brief §12 and §17.3.
 *
 * Three steps, and §16's definition of done asks that animations be "subtle,
 * purposeful and fast". `fast` is a press or a toggle; `normal` a card or
 * sheet entering; `slow` reserved for a genuine moment — a reservation
 * confirming, a reward unlocking — and used perhaps three times in the app.
 *
 * §13 requires these be ignored entirely when the OS asks for reduced motion.
 * That is enforced in `useReducedMotion`, not here: a duration token has no
 * way to know, and a component that reads the token without the hook is the
 * bug worth catching in review.
 */
export const motion = {
  fast: 160,
  normal: 240,
  slow: 420,
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
  /**
   * The home and category hero.
   *
   * Taller than a banner because §5 asks for "one large, editorial food or
   * venue image" carrying a single dominant action, and 16:9 on a phone is a
   * strip rather than a photograph.
   */
  hero: 4 / 3,
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
/**
 * Tab bar height above the safe-area inset, which the layout adds on top.
 * 64 rather than 60: a 23pt icon, a 13pt label line box and the padding around
 * them need it, and at 60 the label lost its descenders on a device with no
 * home indicator.
 */
export const TAB_BAR_HEIGHT = 64;
