import type { ReactNode } from 'react';
import {
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { ScrollYProvider, useScrollOffset } from './Parallax';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { color, gutter, maxContentWidth, radius, space, TAB_BAR_HEIGHT } from '@/theme';

/**
 * Scrolling page. `inTabs` leaves room for the floating tab bar so the last
 * row is never hidden beneath it.
 */
export function Screen({
  children,
  inTabs,
  header,
  contentStyle,
  edgeToEdge,
  refreshing,
  onRefresh,
  topInset = true,
}: {
  children: ReactNode;
  inTabs?: boolean;
  header?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Let the first child (a hero image) run under the status bar and gutters. */
  edgeToEdge?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  topInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bottom = (inTabs ? TAB_BAR_HEIGHT + insets.bottom : insets.bottom) + space.xxxl;
  // The page's scroll position, shared with any hero photo for parallax.
  const { offset, onScroll } = useScrollOffset('y');
  return (
    <View style={styles.fill}>
      <Animated.ScrollView
        style={styles.fill}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          {
            paddingTop: edgeToEdge || !topInset ? 0 : insets.top,
            paddingBottom: bottom,
          },
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={color.accent}
              colors={[color.accent]}
              progressViewOffset={insets.top}
            />
          ) : undefined
        }
      >
        <ScrollYProvider value={offset}>
          {header}
          <View style={[!edgeToEdge && styles.gutter, styles.content, contentStyle]}>
            {children}
          </View>
        </ScrollYProvider>
      </Animated.ScrollView>
    </View>
  );
}

/** Width-capped, gutter-padded column for content inside an edge-to-edge screen. */
export function Column({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.gutter, styles.content, style]}>{children}</View>;
}

/** Circular translucent control for use over imagery (back, close, share). */
export function GlassButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      pressedScale={0.9}
      style={styles.glass}
    >
      {Platform.OS === 'android' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color.chrome }]} />
      ) : (
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <Ionicons name={icon} size={20} color={color.text} />
    </PressableScale>
  );
}

/**
 * Detail-screen header. Floats over a hero (`overlay`) or sits inline.
 * Back always returns where the person came from.
 */
export function BackHeader({
  title,
  overlay,
  right,
}: {
  title?: string;
  overlay?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.backHeader,
        { paddingTop: insets.top + space.sm },
        overlay && styles.backOverlay,
      ]}
    >
      <GlassButton
        icon="chevron-back"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      />
      {title ? (
        <Text
          variant="headline"
          numberOfLines={1}
          style={styles.backTitle}
          accessibilityRole="header"
        >
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  gutter: { paddingHorizontal: gutter },
  content: { width: '100%', maxWidth: maxContentWidth + gutter * 2, alignSelf: 'center' },
  glass: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
  },
  backOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  backTitle: { flex: 1, textAlign: 'center' },
});
