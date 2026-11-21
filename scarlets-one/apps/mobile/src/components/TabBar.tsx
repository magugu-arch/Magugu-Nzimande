import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import { springs, useReducedMotion } from '@/lib/motion';
import { MAX_CONTENT_WIDTH, TAB_BAR_HEIGHT, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Material } from './Material';
import { Press } from './Press';
import { Text } from './Text';

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  match: ['american-football-outline', 'american-football'],
  matchday: ['compass-outline', 'compass'],
  passport: ['card-outline', 'card'],
  'fan-zone': ['megaphone-outline', 'megaphone'],
};

/**
 * Five persistent destinations on a translucent bar that content scrolls
 * beneath. A marker slides between tabs on a critically damped spring and
 * retargets if another tab is tapped before it settles.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const routes = state.routes.filter((route) => ICONS[route.name]);
  const active = Math.max(
    0,
    routes.findIndex((route) => route.key === state.routes[state.index]?.key),
  );
  const tabWidth = width > 0 ? width / routes.length : 0;
  const markerX = useSharedValue(0);
  const target = active * tabWidth + tabWidth / 2 - 14;
  useEffect(() => {
    if (tabWidth > 0) markerX.set(reduced ? target : withSpring(target, springs.move));
  }, [markerX, reduced, tabWidth, target]);
  const marker = useAnimatedStyle(() => ({ transform: [{ translateX: markerX.value }] }));

  return (
    <View
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      accessibilityRole="tablist"
      pointerEvents="box-none"
    >
      <Material
        intensity={80}
        style={{
          paddingBottom: insets.bottom,
          borderTopWidth: 1,
          // A bright top edge: light catching the material.
          borderTopColor:
            theme.scheme === 'dark' ? 'rgba(246,242,236,0.10)' : 'rgba(255,255,255,0.7)',
          alignItems: 'center',
        }}
      >
        <View
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          style={{
            flexDirection: 'row',
            height: TAB_BAR_HEIGHT,
            width: '100%',
            maxWidth: MAX_CONTENT_WIDTH,
          }}
        >
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 28,
                  height: 3,
                  borderBottomLeftRadius: 3,
                  borderBottomRightRadius: 3,
                  backgroundColor: theme.accentText,
                },
                marker,
              ]}
            />
          ) : null}
          {routes.map((route, index) => {
            const focused = index === active;
            const options = descriptors[route.key]?.options;
            const label = typeof options?.title === 'string' ? options.title : route.name;
            const icons = ICONS[route.name] as [IconName, IconName];
            const colour = focused ? theme.accentText : theme.textSecondary;
            return (
              <Press
                key={route.key}
                testID={`tab-${route.name}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                scaleTo={0.92}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    haptic.selection();
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  paddingTop: 4,
                }}
              >
                <Icon name={focused ? icons[1] : icons[0]} size={23} color={colour} />
                <Text
                  variant="caption"
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  style={{
                    color: colour,
                    fontSize: 10.5,
                    lineHeight: 13,
                    fontWeight: focused ? '700' : '500',
                    letterSpacing: 0.1,
                  }}
                >
                  {label}
                </Text>
              </Press>
            );
          })}
        </View>
      </Material>
    </View>
  );
}
