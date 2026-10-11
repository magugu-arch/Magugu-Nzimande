import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assetRegistry, type AssetId } from '@/assets/registry.generated';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { SPRING, project, rubberband, springConfig } from '@/design/motion';

const MAX_SCALE = 4;

/**
 * Full-screen photo. Pinch or double-tap to zoom, pan with momentum and
 * rubber-banded edges, drag down to put it away — the backdrop fades with the
 * drag. X, Y and scale are separate springs, and every release hands its
 * velocity to the spring that finishes the motion.
 */
export default function Zoom() {
  const { asset } = useLocalSearchParams<{ asset: string }>();
  const record = assetRegistry[asset as AssetId];
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ratio = record ? record.width / record.height : 4 / 5;
  const bw = Math.min(W, H * ratio);
  const bh = bw / ratio;

  const s = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const start = useSharedValue({ s: 1, x: 0, y: 0 });

  const close = () => router.back();

  const bounds = (scale: number) => {
    'worklet';
    return { x: Math.max(0, (bw * scale - W) / 2), y: Math.max(0, (bh * scale - H) / 2) };
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = { s: s.value, x: x.value, y: y.value };
    })
    .onUpdate((e) => {
      const raw = start.value.s * e.scale;
      const next =
        raw > MAX_SCALE
          ? MAX_SCALE + rubberband(raw - MAX_SCALE, MAX_SCALE, 0.3)
          : raw < 1
            ? 1 - rubberband(1 - raw, 1, 0.3)
            : raw;
      // Keep the point between the fingers fixed on screen.
      const fx = e.focalX - W / 2;
      const fy = e.focalY - H / 2;
      x.value = fx - (fx - start.value.x) * (next / start.value.s);
      y.value = fy - (fy - start.value.y) * (next / start.value.s);
      s.value = next;
    })
    .onEnd(() => {
      const target = Math.min(MAX_SCALE, Math.max(1, s.value));
      const b = bounds(target);
      s.value = withSpring(target, springConfig(SPRING.settle));
      x.value = withSpring(Math.min(b.x, Math.max(-b.x, x.value)), springConfig(SPRING.settle));
      y.value = withSpring(Math.min(b.y, Math.max(-b.y, y.value)), springConfig(SPRING.settle));
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      start.value = { s: s.value, x: x.value, y: y.value };
    })
    .onUpdate((e) => {
      if (s.value <= 1.01) {
        x.value = start.value.x + rubberband(e.translationX, W, 0.2);
        y.value = start.value.y + e.translationY;
        return;
      }
      const b = bounds(s.value);
      const nx = start.value.x + e.translationX;
      const ny = start.value.y + e.translationY;
      x.value = Math.abs(nx) > b.x ? Math.sign(nx) * (b.x + rubberband(Math.abs(nx) - b.x, W)) : nx;
      y.value = Math.abs(ny) > b.y ? Math.sign(ny) * (b.y + rubberband(Math.abs(ny) - b.y, H)) : ny;
    })
    .onEnd((e) => {
      if (s.value <= 1.01) {
        if (Math.abs(y.value + project(e.velocityY)) > H * 0.22) {
          y.value = withSpring(
            Math.sign(e.velocityY || y.value) * H,
            springConfig(SPRING.settle, e.velocityY),
            (done) => {
              if (done) runOnJS(close)();
            },
          );
          return;
        }
        x.value = withSpring(0, springConfig(SPRING.thrown, e.velocityX));
        y.value = withSpring(0, springConfig(SPRING.thrown, e.velocityY));
        return;
      }
      // Momentum: aim for where the flick would coast to, inside the edges.
      const b = bounds(s.value);
      const tx = Math.min(b.x, Math.max(-b.x, x.value + project(e.velocityX, 0.998)));
      const ty = Math.min(b.y, Math.max(-b.y, y.value + project(e.velocityY, 0.998)));
      x.value = withSpring(tx, springConfig(SPRING.settle, e.velocityX));
      y.value = withSpring(ty, springConfig(SPRING.settle, e.velocityY));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (s.value > 1.05) {
        s.value = withSpring(1, springConfig(SPRING.settle));
        x.value = withSpring(0, springConfig(SPRING.settle));
        y.value = withSpring(0, springConfig(SPRING.settle));
        return;
      }
      const target = 2.5;
      const b = bounds(target);
      const fx = e.x - W / 2;
      const fy = e.y - H / 2;
      s.value = withSpring(target, springConfig(SPRING.settle));
      x.value = withSpring(
        Math.min(b.x, Math.max(-b.x, -fx * (target - 1))),
        springConfig(SPRING.settle),
      );
      y.value = withSpring(
        Math.min(b.y, Math.max(-b.y, -fy * (target - 1))),
        springConfig(SPRING.settle),
      );
    });

  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }],
  }));
  const backdrop = useAnimatedStyle(() => ({
    opacity: s.value <= 1.01 ? Math.max(0.15, 1 - Math.abs(y.value) / (H * 0.6)) : 1,
  }));

  return (
    <View style={styles.fill} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.black, backdrop]} />
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={styles.fill}
          accessible
          accessibilityRole="image"
          accessibilityLabel={record?.alt}
        >
          <Animated.View style={[{ width: bw, height: bh }, imageStyle]}>
            {record ? (
              <Image source={record.source} style={StyleSheet.absoluteFill} contentFit="contain" />
            ) : null}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <PressableScale
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close image"
        style={[styles.close, { top: insets.top + 8 }]}
      >
        <Ionicons name="close" size={22} color="#fff" />
      </PressableScale>
      <Text
        variant="footnote"
        color="white"
        align="center"
        style={[styles.hint, { bottom: insets.bottom + 16 }]}
      >
        Pinch or double-tap to zoom · drag down to close · concept image
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  black: { backgroundColor: '#000' },
  close: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  hint: { position: 'absolute', left: 16, right: 16, opacity: 0.7 },
});
