import { memo } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

export interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  /** Uses the all-white reversal, for bb.q Red and bb.q Black surfaces. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Intrinsic proportions of the lock-up, from the master artwork. */
const ASPECT = 1552 / 278;

const WIDTHS = { sm: 120, md: 168, lg: 240 } as const;

/**
 * The bb.q Chicken primary logo (full lock-up).
 *
 * The licensed artwork, not type: brand guidelines v1.0 §3.1 requires the
 * official master file and forbids rebuilding the mark from fonts. Both
 * variants are generated from that master by `npm run assets:brand`, so this
 * component only chooses between them and sizes the result.
 *
 * Height is derived from the master's own aspect ratio rather than set
 * independently, which is what keeps §3.1's "do not stretch" true no matter
 * what a caller passes in `style`.
 */
export const BrandMark = memo(function BrandMark({
  size = 'md',
  onDark = false,
  style,
}: BrandMarkProps) {
  const width = WIDTHS[size];

  return (
    <View style={style}>
      <Image
        source={
          onDark
            ? require('@assets/brand/lockup-reversed.png')
            : require('@assets/brand/lockup.png')
        }
        style={{ width, height: width / ASPECT }}
        resizeMode="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel="bb.q Chicken"
      />
    </View>
  );
});
