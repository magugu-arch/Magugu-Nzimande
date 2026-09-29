import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageMeta, type PageMetaProps } from '@/seo/PageMeta';
import { scrollableByKeyboard } from '@/utils/a11y';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors, HIT_SLOP, radius, spacing } from '@/theme';
import { Text } from './Text';

/** A scrolling screen on the obsidian ground, safe-area aware. */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  padded = true,
  topInset = true,
  contentStyle,
  refreshControl,
  meta,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ScrollViewProps['refreshControl'];
  /** What this page tells search engines and shared links (web only). */
  meta?: PageMetaProps;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        padded && styles.padded,
        { paddingBottom: (footer ? spacing.lg : spacing.xxxl) + (footer ? 0 : insets.bottom) },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      // A page of pictures or of prose has nothing to tab to, so on the web the
      // scrolling area itself takes focus: somebody using only a keyboard can
      // still read to the end of it.
      {...scrollableByKeyboard}
      // The body of the page is its main region, which is how a screen reader
      // offers "skip to the content".
      role="main"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentStyle]} role="main">
      {children}
    </View>
  );
  return (
    <KeyboardAvoidingView
      style={[styles.flex, styles.ground, { paddingTop: topInset && !header ? insets.top : 0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {meta ? <PageMeta {...meta} /> : null}
      {header}
      {body}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Top bar for pushed screens: back, centred title, optional action. */
export function Header({
  title,
  right,
  onBack,
  transparent,
}: {
  title?: string;
  right?: ReactNode;
  onBack?: () => void;
  transparent?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/home')));
  return (
    <View
      role="banner"
      style={[
        styles.header,
        { paddingTop: insets.top + spacing.xs },
        transparent ? styles.headerTransparent : styles.headerSolid,
      ]}
    >
      <Pressable
        onPress={back}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.iconButton, transparent && styles.iconButtonOnPhoto]}
      >
        <Feather name="chevron-left" size={22} color={colors.text} />
      </Pressable>
      <Text
        variant="eyebrow"
        color="text"
        numberOfLines={1}
        style={styles.headerTitle}
        accessibilityRole="header"
      >
        {title ?? ''}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  onPhoto,
  badge,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  onPhoto?: boolean;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      style={[styles.iconButton, onPhoto && styles.iconButtonOnPhoto]}
    >
      <Feather name={icon} size={20} color={colors.text} />
      {badge ? (
        <View style={styles.badge}>
          <Text variant="caption" style={styles.badgeText}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The board's section opener: tracked capitals in brass, then a Playfair title. */
export function SectionTitle({
  eyebrow,
  title,
  action,
  onAction,
  style,
}: {
  eyebrow?: string;
  title?: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.flex}>
        {eyebrow ? (
          <Text variant="eyebrow" color="accent">
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text
            variant="h2"
            accessibilityRole="header"
            style={eyebrow ? { marginTop: spacing.xs } : null}
          >
            {title}
          </Text>
        ) : null}
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={HIT_SLOP}
          accessibilityRole="link"
          accessibilityLabel={action}
        >
          <Text variant="eyebrow" color="textMuted">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The short brass rule under the wordmark on the board. */
export function BrassRule({ width = 40, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width, height: 1, backgroundColor: colors.accent }, style]} />;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ground: { backgroundColor: colors.background },
  padded: { paddingHorizontal: spacing.gutter },
  footer: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 10,
  },
  headerSolid: { backgroundColor: colors.background },
  headerTransparent: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonOnPhoto: { backgroundColor: colors.scrim },
  badge: {
    position: 'absolute',
    top: 6,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.textOnAccent, fontSize: 10, lineHeight: 12 },
  section: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
});
