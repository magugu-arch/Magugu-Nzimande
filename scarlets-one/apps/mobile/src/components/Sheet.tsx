import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { project, rubberband, springs, useReducedMotion } from '@/lib/motion';
import { MAX_CONTENT_WIDTH, elevation, hitTarget, radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testID?: string;
}

/**
 * A bottom sheet that behaves like an object, not a scripted animation.
 *
 * - It follows the finger 1:1 from where it was grabbed, and resists
 *   progressively when pulled past its resting height instead of stopping.
 * - It can be caught mid-flight: grabbing cancels the spring and the drag
 *   starts from the sheet's position at that instant.
 * - On release it decides from where the gesture is GOING (position plus
 *   projected momentum), then springs there carrying the finger's velocity,
 *   so there is no seam between dragging and settling.
 * - It leaves the way it came, and a scrim dims what is behind it in step.
 *
 * Dragging is never the only way out: the Close button, the scrim, Escape
 * and the system back gesture all dismiss it. With reduced motion it fades.
 */
export function Sheet({ visible, onClose, title, children, testID }: SheetProps) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const window = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);

  /** 0 = fully open. Positive = pushed down by that many points. */
  const offset = useSharedValue(window.height);
  const height = useSharedValue(window.height);
  const start = useSharedValue(0);
  const fade = useSharedValue(0);

  // Mount as soon as it is asked for; unmount only once it has finished leaving.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      if (reduced) {
        offset.set(0);
        fade.set(withTiming(1, { duration: 180 }));
      } else {
        fade.set(1);
        offset.set(withSpring(0, springs.sheetProgrammatic));
      }
      return;
    }
    const finish = () => setMounted(false);
    if (reduced) {
      fade.set(
        withTiming(0, { duration: 160 }, (done) => {
          if (done) scheduleOnRN(finish);
        }),
      );
    } else {
      offset.set(
        withSpring(height.value + 40, springs.sheetProgrammatic, (done) => {
          if (done) scheduleOnRN(finish);
        }),
      );
    }
    // Shared values are stable; only the visible flag drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  const settled = () => haptic.snap();

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      // Catch it mid-flight: stop the spring and drag from where it is now.
      cancelAnimation(offset);
      start.set(offset.value);
    })
    .onUpdate((event) => {
      const raw = start.value + event.translationY;
      offset.set(raw < 0 ? rubberband(raw, height.value) : raw);
    })
    .onEnd((event) => {
      const velocity = event.velocityY;
      const landing = offset.value + project(velocity, 0.99);
      const dismiss = landing > height.value * 0.5;
      // Overshoot is earned by momentum. A slow release settles without it.
      const config = Math.abs(velocity) > 400 ? springs.sheet : springs.sheetProgrammatic;
      if (dismiss) {
        offset.set(withSpring(height.value + 40, { ...config, velocity }));
        scheduleOnRN(onClose);
      } else {
        offset.set(
          withSpring(0, { ...config, velocity }, (done) => {
            if (done) scheduleOnRN(settled);
          }),
        );
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reduced ? 0 : offset.value }],
    opacity: reduced ? fade.value : 1,
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: reduced
      ? fade.value
      : interpolate(offset.value, [0, Math.max(1, height.value)], [1, 0], 'clamp'),
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, scrimStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
        </Animated.View>
        <View
          style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}
          pointerEvents="box-none"
        >
          <Animated.View
            testID={testID}
            accessibilityViewIsModal
            onLayout={(e) => {
              height.set(e.nativeEvent.layout.height);
            }}
            style={[
              {
                width: '100%',
                maxWidth: MAX_CONTENT_WIDTH,
                maxHeight: window.height - insets.top - space.xxl,
                backgroundColor: theme.surface,
                borderTopLeftRadius: radius.xl + 4,
                borderTopRightRadius: radius.xl + 4,
                borderCurve: 'continuous',
                ...elevation(theme, 3),
              },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View>
                <View style={{ alignItems: 'center', paddingTop: space.sm }}>
                  <View
                    style={{
                      width: 38,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: theme.hairline,
                    }}
                  />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingLeft: space.xl,
                    paddingRight: space.md,
                    paddingTop: space.sm,
                    paddingBottom: space.md,
                    gap: space.md,
                  }}
                >
                  <Text variant="title3" accessibilityRole="header" style={{ flex: 1 }}>
                    {title}
                  </Text>
                  <Press
                    testID={testID ? `${testID}-close` : undefined}
                    onPress={onClose}
                    accessibilityLabel={t('common.close')}
                    style={{
                      width: hitTarget,
                      height: hitTarget,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: theme.surfaceMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="close" size={18} color={theme.textSecondary} />
                    </View>
                  </Press>
                </View>
              </View>
            </GestureDetector>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: space.xl,
                paddingBottom: insets.bottom + space.xxl,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
