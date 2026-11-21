import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceTransparency } from '@/lib/motion';
import { useTheme } from '@/theme';

export interface MaterialProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Bigger surfaces read as thicker: more blur for a bar than a chip. */
  intensity?: number;
  /** Force the dark material: for chrome that sits over photography. */
  dark?: boolean;
}

/**
 * Translucent chrome that content scrolls beneath, instead of an opaque bar
 * that takes a strip of the screen.
 *
 * It turns solid when the reader asks for reduced transparency or more
 * contrast. On Android it is a near-opaque tint: a real blur there needs the
 * blurred content wrapped in a BlurTargetView, which is a per-screen change
 * left for the native build pass.
 */
export function Material({ children, style, intensity = 60, dark }: MaterialProps) {
  const theme = useTheme();
  const solid = useReduceTransparency();
  const isDark = dark ?? theme.scheme === 'dark';
  if (solid) {
    return (
      <View style={[{ backgroundColor: isDark ? '#141114' : theme.materialSolid }, style]}>
        {children}
      </View>
    );
  }
  if (Platform.OS === 'android') {
    return (
      <View
        style={[
          { backgroundColor: isDark ? 'rgba(20,17,20,0.94)' : 'rgba(246,242,236,0.95)' },
          style,
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <BlurView
      intensity={intensity}
      tint={isDark ? 'dark' : 'light'}
      style={[
        { backgroundColor: isDark ? 'rgba(20,17,20,0.62)' : theme.material, overflow: 'hidden' },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}
