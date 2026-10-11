import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useEffect, useState } from 'react';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/design/theme';

/**
 * Floating chrome as a translucent material the content passes beneath.
 * iOS gets the system chrome material (which already adapts to dark mode);
 * Android, where a real blur needs a BlurTargetView around the content, gets a
 * thicker tint instead; Reduce Transparency makes it solid everywhere.
 */
export function Material({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors, scheme } = useTheme();
  const reduceTransparency = useReduceTransparency();
  if (reduceTransparency || Platform.OS === 'android') {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: reduceTransparency ? colors.paper : colors.material },
          style,
        ]}
      />
    );
  }
  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <BlurView
        intensity={Platform.OS === 'web' ? 40 : 80}
        tint={Platform.OS === 'ios' ? 'systemChromeMaterial' : scheme === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.material, opacity: Platform.OS === 'ios' ? 0.4 : 1 },
        ]}
      />
    </View>
  );
}

function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setOn);
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOn);
    return () => sub.remove();
  }, []);
  return on;
}
