import { useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type View as ViewType,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPRING, springConfig } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { MIN_TOUCH, radius, space } from '@/design/tokens';
import { useMarket } from '@/features/catalogue';
import { usePrefs } from '@/store/prefs';
import { Material } from './Material';
import { HeaderButton } from './Screen';
import { Text } from './Text';

type Item = {
  key: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
};

const APPEARANCE = [
  { value: 'system', label: 'System', icon: 'contrast-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
] as const;

const WIDTH = 260;

/**
 * The menu button: a pull-down menu in the manner of iOS. It opens on the
 * press, grows out of the button that made it (its transform origin is the
 * button) and shrinks back into it, on one spring that either direction can
 * interrupt. Appearance changes in place; every other item closes the menu
 * and then goes where it says. Under Reduce Motion it cross-fades at full
 * size instead of growing.
 */
export function MenuButton({ onMedia }: { onMedia?: boolean }) {
  const { colors } = useTheme();
  const market = useMarket();
  const appearance = usePrefs((s) => s.appearance);
  const setAppearance = usePrefs((s) => s.setAppearance);
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const anchor = useRef<ViewType>(null);
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const p = useSharedValue(0);

  const sections: Item[][] = [
    [
      { key: 'events', title: 'Events calendar', icon: 'calendar-outline', href: '/events' },
      { key: 'my-events', title: 'My events', icon: 'sparkles-outline', href: '/my-events' },
      { key: 'orders', title: 'Orders and tracking', icon: 'car-outline', href: '/orders' },
      { key: 'stylist', title: 'Book a stylist', icon: 'chatbubble-outline', href: '/appointment' },
    ],
    [
      {
        key: 'market',
        title: 'Market and currency',
        subtitle: `${market.label} · ${market.currencyCode}`,
        icon: 'globe-outline',
        href: '/market',
      },
      {
        key: 'notifications',
        title: 'Notifications',
        icon: 'notifications-outline',
        href: '/notifications',
      },
    ],
    [
      {
        key: 'about',
        title: 'What is real here',
        icon: 'information-circle-outline',
        href: '/about',
      },
    ],
  ];

  const show = () => {
    if (open) return;
    anchor.current?.measureInWindow((x, y, w, h) => {
      setFrame({ x, y, w, h });
      setOpen(true);
      void Haptics.selectionAsync();
      p.set(0);
      p.set(
        reduced
          ? withTiming(1, { duration: 180, reduceMotion: ReduceMotion.Never })
          : withSpring(1, springConfig(SPRING.settle)),
      );
    });
  };

  const hide = (then?: () => void) => {
    const done = () => {
      setOpen(false);
      then?.();
    };
    p.set(
      reduced
        ? withTiming(0, { duration: 150, reduceMotion: ReduceMotion.Never }, (fin) => {
            if (fin) runOnJS(done)();
          })
        : withSpring(0, springConfig(SPRING.snappy), (fin) => {
            if (fin) runOnJS(done)();
          }),
    );
  };

  const choose = (item: Item) => {
    void Haptics.selectionAsync();
    hide(() => router.push(item.href));
  };

  // Hang the menu from the button, inside the screen's edges.
  const width = Math.min(WIDTH, W - 16);
  const top = frame.y + frame.h + 6;
  const left =
    frame.x > W / 2
      ? Math.max(8, Math.min(frame.x + frame.w - width, W - width - 8))
      : Math.max(8, Math.min(frame.x, W - width - 8));
  const originX = frame.x + frame.w / 2 - left;
  const originY = frame.y + frame.h / 2 - top;

  const menuStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.8),
    transform: [{ scale: reduced ? 1 : 0.25 + 0.75 * p.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: p.value }));

  return (
    <View ref={anchor} collapsable={false}>
      <HeaderButton
        icon="ellipsis-horizontal-circle-outline"
        label="Menu"
        hint="Opens a menu"
        expanded={open}
        onMedia={onMedia}
        onPressIn={show}
        onPress={show}
      />
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => hide()}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={() => hide()}
          accessibilityLabel="Close menu"
          accessibilityRole="button"
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
        </Pressable>
        <Animated.View
          role="menu"
          accessibilityLabel="Menu"
          accessibilityViewIsModal
          style={[
            styles.menu,
            {
              top,
              left,
              width,
              maxHeight: H - top - insets.bottom - 12,
              borderColor: colors.hairlineStrong,
              // Android has no live blur behind a modal; keep the menu legible.
              backgroundColor: Platform.OS === 'android' ? colors.card : undefined,
              transformOrigin: `${originX}px ${originY}px`,
            },
            menuStyle,
          ]}
        >
          <Material style={StyleSheet.absoluteFill} />
          <ScrollView bounces={false}>
            <View role="radiogroup" accessibilityLabel="Appearance" style={styles.palette}>
              {APPEARANCE.map((a) => {
                const on = appearance === a.value;
                return (
                  <Pressable
                    key={a.value}
                    role="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${a.label} appearance`}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setAppearance(a.value);
                    }}
                    style={({ pressed }) => [
                      styles.swatch,
                      on && { backgroundColor: colors.card, borderColor: colors.hairlineStrong },
                      pressed && { backgroundColor: colors.hairlineStrong },
                    ]}
                  >
                    <Ionicons name={a.icon} size={20} color={on ? colors.ink : colors.ink2} />
                    <Text variant="caption" weight="600" color={on ? 'ink' : 'ink2'}>
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {sections.map((section, i) => (
              <View
                key={i}
                style={[styles.section, { borderTopColor: colors.hairline }]}
                role="group"
              >
                {section.map((item, j) => (
                  <Pressable
                    key={item.key}
                    role="menuitem"
                    accessibilityLabel={
                      item.subtitle ? `${item.title}, ${item.subtitle}` : item.title
                    }
                    onPress={() => choose(item)}
                    testID={`menu-${item.key}`}
                    style={({ pressed }) => [
                      styles.item,
                      j > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.hairline,
                      },
                      pressed && { backgroundColor: colors.hairlineStrong },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="callout">{item.title}</Text>
                      {item.subtitle ? (
                        <Text variant="footnote" color="ink3">
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name={item.icon} size={20} color={colors.ink} />
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(22,19,15,0.08)' },
  menu: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  palette: { flexDirection: 'row', gap: space.xs + 2, padding: space.s },
  swatch: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.s,
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  section: { borderTopWidth: 7 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.l,
    paddingVertical: space.s,
  },
});
