import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

export interface ProgressBarProps {
  /** 0..1 — values outside the range are clamped. */
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const ProgressBar = memo(function ProgressBar({
  progress,
  height = 8,
  trackColor = colors.surfaceAlt,
  fillColor = colors.primary,
  style,
  accessibilityLabel,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  return (
    <View
      style={[styles.track, { height, backgroundColor: trackColor }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: fillColor, height }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  track: { width: '100%', borderRadius: radius.pill, overflow: 'hidden' },
  fill: { borderRadius: radius.pill },
});
