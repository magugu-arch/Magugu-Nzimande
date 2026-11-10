import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { color, gutter, radius, space } from '@/theme';
import { anyDemo } from '@kc-one/contracts';
import { capabilities } from '@/config/env';

/**
 * The editorial masthead from the design reference: a typeset wordmark over a
 * tracked subline on the left, one pill action on the right. The wordmark is
 * set in the display face; it is not the club's logo artwork.
 */
export function AppHeader({
  subline = 'One club · One family',
  action,
  overlay,
}: {
  subline?: string;
  action?: ReactNode;
  overlay?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.md }, overlay && styles.overlay]}>
      <View
        style={{ flex: 1, gap: 2 }}
        accessible
        accessibilityRole="header"
        accessibilityLabel="Kaizer Chiefs One"
      >
        <Text variant="title1" style={styles.wordmark}>
          KAIZER CHIEFS
        </Text>
        <View style={styles.subRow}>
          <Text variant="micro" color="textSecondary" style={styles.subline} numberOfLines={1}>
            {subline}
          </Text>
          {anyDemo(capabilities) ? (
            <View style={styles.demo} accessibilityLabel="Demo build: sample content only">
              <Text variant="micro" style={{ color: color.demoText }}>
                DEMO
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {action}
    </View>
  );
}

/** The reference's rounded "≡ MENU" pill, reused for header actions. */
export function HeaderPill({
  icon,
  label,
  onPress,
  badge,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  onPress: () => void;
  badge?: number;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={badge ? `${accessibilityLabel}, ${badge} unread` : accessibilityLabel}
      pressedScale={0.94}
      style={[styles.pill, !label && styles.pillIcon]}
    >
      <Ionicons name={icon} size={18} color={color.text} />
      {label ? (
        <Text variant="labelSmall" style={{ letterSpacing: 1.6 }}>
          {label}
        </Text>
      ) : null}
      {badge ? (
        <View style={styles.badge}>
          <Text variant="micro" style={{ color: color.onAccent, fontSize: 9, lineHeight: 12 }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingBottom: space.lg,
  },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  wordmark: {
    fontFamily: 'BarlowCondensed_600SemiBold',
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: 2.2,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  subline: { letterSpacing: 2.4, flexShrink: 1 },
  demo: {
    backgroundColor: color.demoBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(36,36,36,0.85)',
    borderWidth: 1,
    borderColor: color.lineStrong,
  },
  pillIcon: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
});
