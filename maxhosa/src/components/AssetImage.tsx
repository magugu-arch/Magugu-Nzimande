import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import { assetRegistry, type AssetId } from '@/assets/registry.generated';
import { useTheme } from '@/design/theme';
import { Text } from './Text';

type Props = {
  assetId: string;
  style?: StyleProp<ViewStyle>;
  /** Decorative when the surrounding control already says what it is. */
  decorative?: boolean;
  contentPosition?: 'top' | 'center';
  priority?: 'low' | 'normal' | 'high';
};

/**
 * One of the 24 verified concept images. Anything else is refused — the
 * registry is the allowlist. A tinted frame shows while it decodes; if it
 * fails, the frame says so in words instead of showing a broken icon.
 */
export function AssetImage({
  assetId,
  style,
  decorative,
  contentPosition = 'center',
  priority = 'normal',
}: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const asset = assetRegistry[assetId as AssetId];
  return (
    <View
      style={[styles.frame, { backgroundColor: colors.sunk }, style]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : asset?.alt}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      {asset && !failed ? (
        <Image
          source={asset.source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={contentPosition}
          transition={reduced ? 0 : 220}
          priority={priority}
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : (
        <View style={styles.fallback}>
          <Text variant="caption" color="ink3" align="center">
            Image unavailable
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
});
