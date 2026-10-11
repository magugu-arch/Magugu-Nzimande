import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { SPRING, project, rubberband, springConfig } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { TAB_BAR_HEIGHT } from './TabBar';

type ToastSpec = {
  id: number;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: { label: string; run: () => void };
  /** Lift above a screen's own bottom bar. */
  offset?: 'tabs' | 'action-bar' | 'none';
};

const useToastStore = create<{
  current: ToastSpec | null;
  show: (t: Omit<ToastSpec, 'id'>) => void;
  hide: () => void;
}>((set) => ({
  current: null,
  show: (t) => set({ current: { ...t, id: Date.now() } }),
  hide: () => set({ current: null }),
}));

export const toast = (t: Omit<ToastSpec, 'id'>) => useToastStore.getState().show(t);

const HIDDEN = 120;

/**
 * One confirmation at a time, above whatever bar is at the bottom. It rises
 * and leaves the same way, and a finger can flick it away early — the release
 * velocity decides, and is handed to the spring that finishes the motion.
 */
export function ToastHost() {
  const current = useToastStore((s) => s.current);
  const hide = useToastStore((s) => s.hide);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(HIDDEN);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!current) return;
    y.set(HIDDEN);
    y.set(withSpring(0, springConfig(SPRING.settle)));
    timer.current = setTimeout(() => {
      y.set(withSpring(HIDDEN, springConfig(SPRING.settle), (done) => done && runOnJS(hide)()));
    }, 3600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, hide, y]);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      y.set(e.translationY < 0 ? rubberband(e.translationY, 80, 0.3) : e.translationY);
    })
    .onEnd((e) => {
      if (y.get() + project(e.velocityY) > 40) {
        y.set(
          withSpring(
            HIDDEN,
            springConfig(SPRING.settle, e.velocityY),
            (done) => done && runOnJS(hide)(),
          ),
        );
      } else {
        y.set(withSpring(0, springConfig(SPRING.settle, e.velocityY)));
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: Math.max(0, Math.min(1, 1 - y.value / HIDDEN)),
  }));

  if (!current) return null;
  const lift =
    current.offset === 'none'
      ? space.l
      : current.offset === 'action-bar'
        ? 88
        : TAB_BAR_HEIGHT + space.m;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + lift }]}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.toast, { backgroundColor: colors.ink }, style]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Ionicons name={current.icon ?? 'checkmark'} size={18} color={colors.onInk} />
          <Text variant="subhead" weight="600" style={[styles.message, { color: colors.onInk }]}>
            {current.message}
          </Text>
          {current.action ? (
            <PressableScale
              accessibilityRole="button"
              onPress={() => {
                hide();
                current.action?.run();
              }}
              style={styles.action}
            >
              <Text
                variant="subhead"
                weight="700"
                style={{ color: colors.onInk, textDecorationLine: 'underline' }}
              >
                {current.action.label}
              </Text>
            </PressableScale>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: space.gutter, right: space.gutter, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.m,
    paddingLeft: space.l,
    paddingRight: space.s,
    borderRadius: radius.m,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  message: { flex: 1 },
  action: { minHeight: 36, justifyContent: 'center', paddingHorizontal: space.s },
});
