import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { color, space } from '@/theme';

/**
 * The reference's eyebrow: a short gold rule, then tracked mono capitals.
 * "——  AMAKHOSI · ONE APP"
 */
export function Eyebrow({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.eyebrow, style]}>
      <View style={styles.rule} />
      <Text variant="eyebrow" color="accent" style={styles.eyebrowText}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Two-line editorial headline: a strong lead line in ivory, then the accent
 * line in gold italic. "Every Khosi / matters."
 */
export function Headline({
  lead,
  accent,
  size = 'hero',
  style,
}: {
  lead: string;
  accent?: string;
  size?: 'hero' | 'display';
  style?: StyleProp<ViewStyle>;
}) {
  const italic = size === 'hero' ? 'heroItalic' : 'displayItalic';
  return (
    <View
      style={style}
      accessible
      accessibilityRole="header"
      accessibilityLabel={accent ? `${lead} ${accent}` : lead}
    >
      <Text variant={size}>{lead}</Text>
      {accent ? (
        <Text variant={italic} color="accent">
          {accent}
        </Text>
      ) : null}
    </View>
  );
}

/** Section title with an optional trailing action. */
export function SectionTitle({
  title,
  action,
  style,
}: {
  title: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <Text variant="title2" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hr, style]} />;
}

const styles = StyleSheet.create({
  eyebrow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  rule: { width: 28, height: 1.5, backgroundColor: color.accent, marginTop: 8 },
  eyebrowText: { flex: 1 },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: color.line },
});
