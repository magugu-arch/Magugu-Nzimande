/**
 * Mábu colour tokens — read off the supplied brand board's COLOUR PALETTE panel.
 *
 *   Obsidian   #0B0B0B   the ground: every screen sits on it
 *   Charcoal   #1A1A1A   raised surfaces — cards, sheets, the tab bar
 *   Ivory      #E8E1D6   text, and the light half of the floor pattern
 *   Forest     #1E3A2E   the velvet banquettes; the brand-icons panel ground
 *   Brass      #C9A35B   the chandeliers — the one accent, and every call to action
 *   Copper     #A35A3A   warm secondary accent
 *   Terracotta #8A4B2F   warm tertiary accent; also carries destructive actions
 *   Warm Wood  #7A5A3B   the chair frames; borders on brass-adjacent surfaces
 *   Stone      #B7AEA4   secondary text
 *
 * The board shows a dark system, so the app is dark-only (app.json sets
 * userInterfaceStyle "dark"). Screens never hard-code a hex value.
 */
export const palette = {
  obsidian: '#0B0B0B',
  charcoal: '#1A1A1A',
  ivory: '#E8E1D6',
  forest: '#1E3A2E',
  brass: '#C9A35B',
  copper: '#A35A3A',
  terracotta: '#8A4B2F',
  warmWood: '#7A5A3B',
  stone: '#B7AEA4',
} as const;

export const colors = {
  background: palette.obsidian,
  surface: palette.charcoal,
  /** A step above charcoal for inputs and pressed rows. */
  surfaceRaised: '#242220',
  forest: palette.forest,

  text: palette.ivory,
  textMuted: palette.stone,
  /** Captions and disabled labels; still 5.9:1 on obsidian. */
  textSubtle: '#8F877E',
  textOnAccent: palette.obsidian,

  accent: palette.brass,
  accentPressed: '#B08C47',
  copper: palette.copper,
  /**
   * Copper as it must be when it carries words: the board's copper reads at
   * only 3.4:1 on charcoal, which is below what somebody with low vision can
   * make out. Lightened to 5.7:1, and used wherever copper is text.
   */
  copperText: '#CB8158',
  terracotta: palette.terracotta,
  wood: palette.warmWood,

  border: '#2E2B28',
  borderStrong: '#4A433C',
  hairline: 'rgba(201, 163, 91, 0.35)',

  /**
   * Status hues. Not on the board — they cannot be, since an error in brass
   * would read as a call to action. Kept muted so they never outshine brass.
   */
  success: '#7FAF8A',
  warning: '#D9A441',
  danger: '#D9785B',

  scrim: 'rgba(11, 11, 11, 0.55)',
  scrimStrong: 'rgba(11, 11, 11, 0.85)',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
