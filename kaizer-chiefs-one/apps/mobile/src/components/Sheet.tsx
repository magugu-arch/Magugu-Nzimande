import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { projectMomentum, rubberband } from '@kc-one/ui';
import { Text } from './Text';
import { color, gutter, radius, space, springConfig } from '@/theme';

const OPEN = springConfig('standard');
const RELEASE = springConfig('sheet');

/**
 * Bottom sheet. It tracks the finger 1:1, resists when pulled up past its
 * resting point, and on release projects the flick's momentum to decide
 * whether to close, handing the finger's velocity to the spring so there is
 * no seam between dragging and animating. It enters and leaves along the
 * same path, from the bottom edge, over a dimming scrim.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [height, setHeight] = useState(600);
  const y = useSharedValue(1000);
  const scrim = useSharedValue(0);

  // Mount as soon as it is asked to show (derived during render, not in an effect).
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      scrim.set(withTiming(1, { duration: 220 }));
      y.set(reduceMotion ? withTiming(0, { duration: 180 }) : withSpring(0, OPEN));
    } else {
      // Leave along the path it came in on, then unmount.
      scrim.set(withTiming(0, { duration: 200 }));
      y.set(
        withTiming(height, { duration: 220 }, (done) => {
          if (done) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [visible, height, reduceMotion, scrim, y]);

  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onChange((e) => {
      const next = y.get() + e.changeY;
      y.set(next < 0 ? -rubberband(-next, height) : next);
    })
    .onEnd((e) => {
      const projected = y.get() + projectMomentum(e.velocityY, 0.99);
      if (projected > height * 0.4) {
        y.set(withSpring(height, { ...RELEASE, velocity: e.velocityY }));
        scrim.set(withTiming(0, { duration: 200 }));
        runOnJS(onClose)();
      } else {
        y.set(withSpring(0, { ...RELEASE, velocity: e.velocityY }));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
            style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }, sheetStyle]}
          >
            <View style={styles.grabber} />
            <Text variant="title3" accessibilityRole="header" style={{ marginBottom: space.md }}>
              {title}
            </Text>
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: color.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    paddingHorizontal: gutter,
    paddingTop: space.md,
    backgroundColor: color.bgRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.lineStrong,
    marginBottom: space.lg,
  },
});
