/** Spacing scale (pt/px). 4-point base. */
export const space = {
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
  colossal: 72,
} as const;

/** Side gutter for full-width screens. */
export const gutter = space.xl;

/**
 * Corner radii. Editorial direction: calls to action are nearly square, as in
 * the design reference; information cards are gently rounded so fixture and
 * ticket data reads as stable, contained units.
 */
export const radius = {
  none: 0,
  xs: 2,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Minimum touch target (Apple HIG 44pt; Material 48dp). */
export const touchTarget = 48;

/** Width breakpoints. */
export const breakpoint = {
  /** Phones. */
  compact: 0,
  /** Large phones in landscape, small tablets. */
  medium: 600,
  /** Tablets and admin on a laptop. */
  expanded: 960,
  /** Admin on a desktop. */
  wide: 1280,
} as const;

/** Readable line length cap for long-form text. */
export const maxContentWidth = 680;

/**
 * Elevation. On dark UI, depth comes mostly from a lighter surface; the shadow
 * only separates floating layers (sheets, the tab bar) from content beneath.
 */
export const elevation = {
  flat: { shadowOpacity: 0, shadowRadius: 0, shadowOffsetY: 0, elevation: 0 },
  raised: { shadowOpacity: 0.25, shadowRadius: 8, shadowOffsetY: 2, elevation: 2 },
  floating: { shadowOpacity: 0.4, shadowRadius: 24, shadowOffsetY: 8, elevation: 8 },
  sheet: { shadowOpacity: 0.5, shadowRadius: 40, shadowOffsetY: -4, elevation: 16 },
} as const;

export type ElevationToken = keyof typeof elevation;

/** Interaction-state tokens shared by every pressable component. */
export const state = {
  pressedScale: 0.97,
  pressedOpacity: 0.85,
  disabledOpacity: 0.4,
  focusRingWidth: 2,
  focusRingOffset: 2,
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  chrome: 20,
  overlay: 30,
  toast: 40,
} as const;
