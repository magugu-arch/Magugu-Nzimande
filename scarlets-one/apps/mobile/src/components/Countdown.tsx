import { countdownTo } from '@scarlets/domain';
import { View } from 'react-native';
import { useNow } from '@/data/queries';
import { useT } from '@/i18n';
import { radius, space } from '@/theme';
import { Text } from './Text';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Time to kick-off, read from the demo clock. Figures are tabular so the row
 * never shifts as digits change. A screen reader hears one plain sentence
 * instead of a label that updates every second.
 */
export function Countdown({ to }: { to: string }) {
  const t = useT();
  const now = useNow(1000);
  const c = countdownTo(to, now);
  if (c.past) return null;
  const underADay = c.days === 0;
  const parts = underADay
    ? [
        { value: pad(c.hours), label: t('home.hours') },
        { value: pad(c.minutes), label: t('home.minutes') },
        { value: pad(c.seconds), label: 'sec' },
      ]
    : [
        { value: String(c.days), label: t('home.days') },
        { value: pad(c.hours), label: t('home.hours') },
        { value: pad(c.minutes), label: t('home.minutes') },
      ];
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={parts.map((p) => `${Number(p.value)} ${p.label}`).join(', ')}
      style={{ flexDirection: 'row', gap: space.sm }}
    >
      {parts.map((part) => (
        <View
          key={part.label}
          style={{
            minWidth: 64,
            paddingVertical: space.sm,
            paddingHorizontal: space.md,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(246,242,236,0.14)',
            borderWidth: 1,
            borderColor: 'rgba(246,242,236,0.16)',
            alignItems: 'center',
          }}
        >
          <Text variant="title1" color="onInverse" numeric>
            {part.value}
          </Text>
          <Text variant="eyebrow" color="onInverseMuted" style={{ fontSize: 10 }}>
            {part.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
