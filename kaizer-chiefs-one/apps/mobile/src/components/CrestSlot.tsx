import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { brandAssets } from '@/config/brandAssets';
import { Text } from './Text';
import { color } from '@/theme';

/**
 * Reserved space for the official crest.
 *
 * The crest is protected artwork: it is never redrawn, approximated or
 * generated here. This slot shows a neutral placeholder until the club
 * supplies the approved file and it is registered in `config/brandAssets.ts`.
 * The approved file is then shown exactly as supplied: no tint, no effects.
 */
export function CrestSlot({ size = 44, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (brandAssets.crest) {
    return (
      <Image
        source={brandAssets.crest}
        style={[dims, style as never]}
        contentFit="contain"
        accessibilityLabel="Kaizer Chiefs crest"
      />
    );
  }
  return (
    <View
      accessible
      accessibilityLabel="Crest placeholder. Approved club artwork pending."
      style={[styles.slot, dims, style]}
    >
      {size >= 40 ? (
        <Text
          variant="micro"
          color="textTertiary"
          style={{ fontSize: Math.max(7, Math.round(size / 7)), letterSpacing: 0.6 }}
          numberOfLines={1}
        >
          CREST
        </Text>
      ) : null}
    </View>
  );
}

/** Neutral badge slot for opponent teams, whose marks we also do not draw. */
export function BadgeSlot({ size = 40 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityLabel="Team badge placeholder"
      style={[styles.badge, { width: size, height: size * 1.12 }]}
    />
  );
}

const styles = StyleSheet.create({
  slot: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.lineAccent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,180,60,0.05)',
  },
  badge: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: color.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
});
