import { themes, type Theme } from '@scarlets/ui';
import { useColorScheme, type ViewStyle } from 'react-native';
import { usePrefs } from '@/state/prefs';

export { hitTarget, radius, space, type as typeScale } from '@scarlets/ui';
export type { Theme, TypeVariant } from '@scarlets/ui';

/** Height of the tab bar above the home indicator. */
export const TAB_BAR_HEIGHT = 56;

/** Content never stretches wider than this, so the app holds up on tablets and the web. */
export const MAX_CONTENT_WIDTH = 720;

export function useTheme(): Theme {
  const preference = usePrefs((s) => s.theme);
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return themes[scheme];
}

/**
 * Elevation. Bigger surfaces read as thicker: a card sits low, a sheet floats.
 * Shadows are soft and tinted by the theme's shadow colour rather than pure
 * black, and nearly vanish in dark mode where a lighter surface does the work.
 */
export function elevation(theme: Theme, level: 1 | 2 | 3): ViewStyle {
  const dark = theme.scheme === 'dark';
  const spec = {
    1: { y: 2, blur: 10, alpha: dark ? 0.3 : 0.06 },
    2: { y: 8, blur: 24, alpha: dark ? 0.4 : 0.1 },
    3: { y: 16, blur: 44, alpha: dark ? 0.55 : 0.18 },
  }[level];
  return { boxShadow: `0px ${spec.y}px ${spec.blur}px rgba(25, 22, 25, ${spec.alpha})` };
}
