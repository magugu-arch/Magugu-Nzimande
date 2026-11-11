import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Parallax. Photographs sit further back than the interface: a hero photo
 * travels at about a third of the scroll speed, and a photo in a horizontal
 * rail slides a little inside its card as the rail scrolls. The offsets are
 * computed on the UI thread from the scroll position, so they track the
 * finger exactly, and Reduce Motion switches every one of them off.
 */
export const HERO_RATE = 0.32;
const DRIFT_RATE = 0.08;
/** Largest drift, as a share of the card's width. The layer overscans by 7%. */
const DRIFT_MAX = 0.06;

const ScrollYContext = createContext<SharedValue<number> | null>(null);
export const ScrollYProvider = ScrollYContext.Provider;

/** A scroll offset shared value and the handler that keeps it current. */
export function useScrollOffset(axis: 'x' | 'y' = 'y') {
  const offset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    offset.set(axis === 'y' ? e.contentOffset.y : e.contentOffset.x);
  });
  return { offset, onScroll };
}

/**
 * Fills its frame and moves down at `rate` of the page's scroll, so the
 * picture leaves the screen more slowly than the content above it. The gap
 * this opens is always above the top of the screen.
 */
export function ParallaxLayer({
  rate = HERO_RATE,
  children,
}: {
  rate?: number;
  children: ReactNode;
}) {
  const scrollY = useContext(ScrollYContext);
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY && !reduceMotion ? Math.max(0, scrollY.get()) * rate : 0 }],
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

export interface Drift {
  /** The rail's horizontal scroll offset. */
  scrollX: SharedValue<number>;
  /** Where this card starts in the rail's content, in points. */
  origin: number;
  /** The card's width, in points. */
  span: number;
}

/** A layer slightly wider than its card that slides as the rail scrolls. */
export function DriftLayer({ scrollX, origin, span, children }: Drift & { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ translateX: 0 }] };
    const max = span * DRIFT_MAX;
    const shift = (scrollX.get() - origin) * DRIFT_RATE;
    return { transform: [{ translateX: Math.max(-max, Math.min(max, shift)) }] };
  });
  return <Animated.View style={[styles.drift, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  drift: { position: 'absolute', top: 0, bottom: 0, left: '-7%', right: '-7%' },
});
