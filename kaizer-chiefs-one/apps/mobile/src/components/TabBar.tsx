import { useEffect, useState, type ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { color, space, springConfig, TAB_BAR_HEIGHT } from '@/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  home: ['home', 'home-outline'],
  match: ['football', 'football-outline'],
  fan: ['people', 'people-outline'],
  tickets: ['ticket', 'ticket-outline'],
  profile: ['person-circle', 'person-circle-outline'],
};

const SPRING = springConfig('standard');

/**
 * Floating translucent tab bar: content scrolls underneath a dark material
 * rather than stopping at an opaque strip. The gold marker springs between
 * tabs and re-targets mid-flight if the supporter taps again.
 */
export function TabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const slot = width / count;
  const x = useSharedValue(0);

  useEffect(() => {
    if (!slot) return;
    const target = state.index * slot + slot / 2 - 12;
    x.value = reduceMotion ? withTiming(target, { duration: 0 }) : withSpring(target, SPRING);
  }, [state.index, slot, reduceMotion, x]);

  const marker = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.material]} />
      <View style={styles.edge} />
      {slot ? <Animated.View style={[styles.marker, marker]} /> : null}
      <View style={styles.row} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label = (options?.title ?? route.name) as string;
          const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              pressedScale={0.9}
              style={styles.item}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  void Haptics.selectionAsync().catch(() => {});
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            >
              <Ionicons
                name={focused ? on : off}
                size={22}
                color={focused ? color.accent : color.textSecondary}
              />
              <Text
                variant="micro"
                style={{ color: focused ? color.accent : color.textSecondary, fontSize: 10 }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  material: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(16,16,16,0.55)' : color.chrome,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px) saturate(160%)' } as object) : null),
  },
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.lineStrong,
  },
  marker: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24,
    height: 2,
    backgroundColor: color.accent,
  },
  row: { flexDirection: 'row', height: TAB_BAR_HEIGHT },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs },
});
