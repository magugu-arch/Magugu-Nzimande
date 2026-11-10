import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { effectiveState, type Provenance } from '@kc-one/contracts';
import { Text } from './Text';
import { color, radius, space } from '@/theme';

type TagKind = 'DEMO' | 'SAMPLE' | 'CONCEPT IMAGE' | 'DRAFT';

/**
 * DEMO / SAMPLE markers. Ivory on black, never gold, so a marker is never
 * mistaken for a brand feature. Screen readers hear the full meaning.
 */
export function DemoTag({
  kind = 'DEMO',
  style,
  onImage,
}: {
  kind?: TagKind;
  style?: StyleProp<ViewStyle>;
  onImage?: boolean;
}) {
  const label =
    kind === 'CONCEPT IMAGE'
      ? 'Concept image, not approved club photography'
      : kind === 'DRAFT'
        ? 'Draft, pending legal review'
        : `${kind.toLowerCase()} content, not live club information`;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.tag, onImage && styles.onImage, style]}
    >
      <Text variant="micro" style={{ color: onImage ? color.text : color.demoText }}>
        {kind}
      </Text>
    </View>
  );
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date(iso));
}

/**
 * One line that says where the data on screen came from and how fresh it is.
 * Stale data says so; demo data says so; nothing is shown as live without it.
 */
export function ProvenanceLine({
  provenance,
  maxAgeMs,
  sourceLabel,
  style,
}: {
  provenance: Provenance;
  maxAgeMs: number;
  sourceLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const s = effectiveState(provenance, new Date(), maxAgeMs);
  const updated = provenance.updatedAt ?? provenance.fetchedAt;
  const text =
    s === 'demo'
      ? 'Sample content · not club data'
      : s === 'stale'
        ? `Not up to date · last updated ${formatTime(updated)}`
        : `${sourceLabel ?? provenance.source} · updated ${formatTime(updated)}`;
  return (
    <View style={[styles.line, style]}>
      {s === 'demo' ? <DemoTag /> : null}
      {s === 'stale' ? <Ionicons name="time-outline" size={12} color={color.warning} /> : null}
      <Text
        variant="micro"
        color={s === 'stale' ? 'warning' : 'textTertiary'}
        style={{ flexShrink: 1 }}
      >
        {text}
      </Text>
    </View>
  );
}

/** Small status pill, e.g. "PENDING REVIEW", "H", "A". */
export function Pill({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'live' | 'success' | 'danger' | 'outline';
  style?: StyleProp<ViewStyle>;
}) {
  const map = {
    neutral: { bg: color.surfaceHigh, fg: color.text, border: 'transparent' },
    accent: { bg: color.accent, fg: color.onAccent, border: 'transparent' },
    live: { bg: color.live, fg: color.textInverse, border: 'transparent' },
    success: { bg: 'transparent', fg: color.success, border: color.success },
    danger: { bg: 'transparent', fg: color.danger, border: color.danger },
    outline: { bg: 'transparent', fg: color.text, border: color.lineStrong },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg, borderColor: map.border }, style]}>
      <Text variant="micro" style={{ color: map.fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: color.demoBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  onImage: {
    backgroundColor: 'rgba(16,16,16,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
});
