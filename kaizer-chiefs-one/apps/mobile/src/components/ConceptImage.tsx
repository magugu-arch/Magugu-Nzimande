import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { imagery, type ImageKey } from '@/config/imagery';
import { DemoTag } from './Tags';
import { color } from '@/theme';

/**
 * Renders a registered image. Concept images always carry a visible
 * CONCEPT IMAGE tag, so a generated picture is never presented as approved
 * club photography.
 */
export function ConceptImage({
  imageKey,
  style,
  fade = 'none',
  position = 'center',
  tag = 'top-left',
  decorative,
}: {
  imageKey: ImageKey;
  style?: StyleProp<ViewStyle>;
  /** Fade the picture into the page background, as the editorial hero does. */
  fade?: 'none' | 'bottom' | 'full';
  position?: ImageContentPosition;
  tag?: 'top-left' | 'bottom-left' | 'top-right' | 'hero' | 'none';
  /** True when adjacent text already describes the picture. */
  decorative?: boolean;
}) {
  const entry = imagery[imageKey];
  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={entry.source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={position}
        transition={180}
        accessible={!decorative}
        accessibilityLabel={decorative ? undefined : entry.alt}
        accessibilityIgnoresInvertColors
      />
      {fade !== 'none' ? (
        <LinearGradient
          pointerEvents="none"
          colors={
            fade === 'full'
              ? ['rgba(16,16,16,0.82)', 'rgba(16,16,16,0.15)', 'rgba(16,16,16,0.1)', color.bg]
              : ['rgba(16,16,16,0)', 'rgba(16,16,16,0)', color.bg]
          }
          locations={fade === 'full' ? [0, 0.24, 0.5, 1] : [0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {entry.status === 'concept' && tag !== 'none' ? (
        <DemoTag kind="CONCEPT IMAGE" onImage style={[styles.tag, styles[tag]]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: color.surface },
  tag: { position: 'absolute' },
  'top-left': { top: 10, left: 10 },
  'top-right': { top: 10, right: 10 },
  'bottom-left': { bottom: 10, left: 10 },
  // Heroes have text pulled up over their lower edge; sit above it, on the right.
  hero: { bottom: 84, right: 12 },
});
