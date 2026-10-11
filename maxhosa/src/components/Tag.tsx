import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { availabilitySummary } from '@/domain/catalogue';
import type { Product } from '@/domain/types';
import { Text } from './Text';

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'sample';

/** Status never rests on colour alone: every tone carries an icon or words. */
export function Tag({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const map = {
    neutral: [colors.sunk, colors.ink2],
    ok: [colors.greenSoft, colors.green],
    warn: [colors.ochreSoft, colors.ink],
    bad: [colors.rustSoft, colors.rust],
    info: [colors.cobaltSoft, colors.cobalt],
    sample: ['transparent', colors.ink3],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: bg },
        tone === 'sample' && {
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.hairlineStrong,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text variant="caption" weight="700" style={{ color: fg }} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </View>
  );
}

export function AvailabilityBadge({ product }: { product: Product }) {
  const a = availabilitySummary(product);
  const icon = a.tone === 'bad' ? 'remove' : a.tone === 'warn' ? 'time-outline' : 'checkmark';
  return <Tag label={a.label} tone={a.tone} icon={icon} />;
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.s,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});
