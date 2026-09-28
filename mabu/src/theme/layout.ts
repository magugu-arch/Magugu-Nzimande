export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  /** The board's generous editorial margin. */
  gutter: 20,
} as const;

/** Restrained corners: luxury reads as near-square, not bubbly. */
export const radius = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 8,
  pill: 999,
} as const;

export const MIN_TOUCH_TARGET = 44;
export const TAB_BAR_HEIGHT = 58;
export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

export const motion = {
  fast: 160,
  base: 260,
  slow: 520,
} as const;
