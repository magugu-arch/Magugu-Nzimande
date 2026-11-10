import { Platform, type TextStyle } from 'react-native';
import {
  color,
  elevation,
  fontFamily,
  leadingPx,
  radius,
  space,
  spring,
  state,
  textStyle,
  toPhysicalSpring,
  trackingPx,
  type ElevationToken,
  type SpringToken,
  type TextStyleName,
} from '@kc-one/ui';

export { color, radius, space, state, gutter, touchTarget, maxContentWidth } from '@kc-one/ui';

/** React Native text styles generated from the shared type tokens. */
export const type = Object.fromEntries(
  (Object.keys(textStyle) as TextStyleName[]).map((name) => {
    const t = textStyle[name];
    const s: TextStyle = {
      fontFamily: fontFamily[t.family],
      fontSize: t.size,
      lineHeight: leadingPx(t),
      letterSpacing: trackingPx(t),
    };
    if ('uppercase' in t && t.uppercase) s.textTransform = 'uppercase';
    if ('tabular' in t && t.tabular) s.fontVariant = ['tabular-nums'];
    return [name, s];
  }),
) as Record<TextStyleName, TextStyle>;

/** Reanimated spring configs from the shared damping-ratio/response tokens. */
export function springConfig(name: SpringToken = 'standard') {
  return toPhysicalSpring(spring[name]);
}

export function shadow(level: ElevationToken) {
  const e = elevation[level];
  if (Platform.OS === 'android') return { elevation: e.elevation };
  return {
    shadowColor: '#000',
    shadowOpacity: e.shadowOpacity,
    shadowRadius: e.shadowRadius,
    shadowOffset: { width: 0, height: e.shadowOffsetY },
  };
}

export const TAB_BAR_HEIGHT = 58;

export const theme = { color, space, radius, type, state };
