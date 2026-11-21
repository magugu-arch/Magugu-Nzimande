import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useL } from '@/i18n';
import { useReducedMotion } from '@/lib/motion';
import { mediaAsset, mediaSource } from '@/media';

export interface PhotoProps {
  id: string;
  style?: StyleProp<ViewStyle>;
  /** True when the image adds nothing a screen reader needs to hear. */
  decorative?: boolean;
  contentFit?: 'cover' | 'contain';
  /** Load ahead of other images: for whatever is first on screen. */
  priority?: boolean;
}

/**
 * A supplied concept image. It paints its average colour and a 16 px
 * placeholder straight away, then cross-fades to the photograph, cropped
 * around its focal point so a face is not cut off in a tall or wide frame.
 * Alt text describes what is visible and never names a person.
 */
export function Photo({ id, style, decorative, contentFit = 'cover', priority }: PhotoProps) {
  const l = useL();
  const reduced = useReducedMotion();
  const asset = mediaAsset(id);
  const source = mediaSource(id);
  if (!asset || source === undefined) {
    return <View style={[{ backgroundColor: '#3B101B' }, style]} />;
  }
  return (
    <View style={[{ backgroundColor: asset.average ?? 'transparent', overflow: 'hidden' }, style]}>
      <Image
        source={source}
        placeholder={asset.placeholder ? { uri: asset.placeholder } : undefined}
        placeholderContentFit="cover"
        contentFit={contentFit}
        contentPosition={{ left: `${asset.focus.x * 100}%`, top: `${asset.focus.y * 100}%` }}
        transition={reduced ? 0 : 240}
        priority={priority ? 'high' : 'normal'}
        alt={decorative ? '' : l(asset.alt)}
        accessible={!decorative}
        accessibilityLabel={decorative ? undefined : l(asset.alt)}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
