import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { brand } from '@/data/pappasContent';
import { colors, spacing } from '@/theme';

export interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  /** Reversed out, for charcoal surfaces and over photography. */
  onDark?: boolean;
  /** Drops the descriptor line, for tight spaces like a nav bar. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  sm: { sprig: 16, name: 18, tracking: 4, descriptor: 8 },
  md: { sprig: 22, name: 26, tracking: 6, descriptor: 9 },
  lg: { sprig: 32, name: 38, tracking: 9, descriptor: 11 },
} as const;

/**
 * The Pappas lock-up.
 *
 * CI sheet (asset 15) panel 01: an olive sprig above `PAPPAS`, with
 * `GREEK & MEDITERRANEAN` letterspaced beneath a rule. Panel 02 shows the
 * stacked, horizontal, roundel and dark-ground variations; this is the
 * stacked primary.
 *
 * ── This is a reconstruction, and it says so ─────────────────────────────
 *
 * §14 is explicit: "Verify official logo/font files before replacing any
 * placeholders with production assets." Pappas has supplied the mark in
 * sixteen photographs and on a brand sheet, but not as a vector file.
 *
 * So the wordmark is *set*, not traced — in Cinzel, which is the face the CI
 * sheet itself specifies for headings and the one the printed lockup is set
 * in. That is a faithful reconstruction rather than an invention: every
 * measurement below (the sprig above the name, the tracking on the
 * descriptor, the rule between them) is read off panel 01.
 *
 * It is still a reconstruction. **Replace this with the official artwork
 * before production**, the way the app this was built from did — that one
 * loaded a licensed master and forbade rebuilding the mark from fonts, which
 * is the right rule once the master exists.
 *
 * The olive sprig is drawn rather than typeset, because there is no font that
 * has it. Its geometry matches `scripts/generate-brand-assets.mjs`, so the
 * mark in the app and the mark on the launcher icon are the same drawing —
 * recognisably the Pappas sprig at the sizes this renders at, and not a claim
 * to be the licensed original.
 */
export const BrandMark = memo(function BrandMark({
  size = 'md',
  onDark = false,
  compact = false,
  style,
}: BrandMarkProps) {
  const scale = SIZES[size];
  const ink = onDark ? colors.textOnDark : colors.textPrimary;
  const accent = onDark ? colors.accent : colors.primary;

  return (
    <View
      style={[styles.root, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${brand.name} — ${brand.descriptor}`}
    >
      <OliveSprig size={scale.sprig} color={accent} />
      <Text
        variant="h1"
        color={ink}
        style={{
          fontSize: scale.name,
          lineHeight: scale.name * 1.15,
          letterSpacing: scale.tracking,
        }}
      >
        {brand.name}
      </Text>
      {!compact ? (
        <>
          <View
            style={[styles.rule, { backgroundColor: onDark ? colors.accent : colors.border }]}
          />
          <Text
            variant="overline"
            color={onDark ? colors.textOnDarkMuted : colors.textMuted}
            style={{ fontSize: scale.descriptor, letterSpacing: scale.descriptor * 0.28 }}
          >
            {brand.descriptor}
          </Text>
        </>
      ) : null}
    </View>
  );
});

/**
 * The olive sprig.
 *
 * A hairline stem with five leaves springing off it, alternating sides and
 * shortening toward the tip — panel 01's silhouette.
 *
 * ── Two proportions worth keeping ────────────────────────────────────────
 *
 * The first version of this drew two short ellipses on a thick stem and read
 * as a matchstick at icon size. Both faults were proportion, and the same two
 * corrections apply here as in the icon generator:
 *
 *   - An olive leaf is *long*, roughly three times its width, and nearly as
 *     long as the stem is tall. Short leaves read as berries.
 *   - The stem is a hairline beside them, not a bar. At `strokeWidth` 1.6 in
 *     a 24-unit box it dominated everything else; 0.9 lets the leaves carry
 *     the shape.
 *
 * Each leaf is an ellipse whose inner tip sits on the stem and whose body
 * extends away from it. Centring them *on* the stem — which is what the first
 * pass did — puts half of every leaf on the wrong side and produces a blob.
 */
function OliveSprig({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Stem: a shallow arc from lower-left to upper-right. */}
      <Path
        d="M5 21 Q 10.5 13 17.5 4"
        stroke={color}
        strokeWidth={0.9}
        strokeLinecap="round"
        fill="none"
      />
      {/* Five leaves, alternating sides, shortening toward the tip. */}
      <Ellipse
        cx="12.4"
        cy="12.6"
        rx="3.7"
        ry="1.25"
        fill={color}
        transform="rotate(-15 12.4 12.6)"
      />
      <Ellipse cx="8.0" cy="15.6" rx="3.5" ry="1.2" fill={color} transform="rotate(66 8.0 15.6)" />
      <Ellipse
        cx="16.3"
        cy="7.9"
        rx="3.3"
        ry="1.15"
        fill={color}
        transform="rotate(-13 16.3 7.9)"
      />
      <Ellipse
        cx="11.9"
        cy="10.4"
        rx="3.1"
        ry="1.05"
        fill={color}
        transform="rotate(64 11.9 10.4)"
      />
      <Ellipse
        cx="18.6"
        cy="4.3"
        rx="2.7"
        ry="0.95"
        fill={color}
        transform="rotate(-18 18.6 4.3)"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing.xxs },
  rule: { width: 44, height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
});
