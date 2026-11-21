/**
 * Motion maths, kept free of any animation library so it can be unit-tested
 * and reused on native and web.
 *
 * Every function starts with a 'worklet' directive: Reanimated runs them on
 * the UI thread during a gesture, and outside Reanimated the directive is an
 * inert string.
 */

export interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
}

/**
 * A spring described the way a designer thinks about it.
 *
 * @param response      Seconds to reach the target. Lower is snappier. This is
 *                      not a duration: settle time emerges from the physics.
 * @param dampingRatio  1 settles with no overshoot; below 1 overshoots.
 */
export function spring(response: number, dampingRatio: number): SpringConfig {
  'worklet';
  const stiffness = Math.pow((2 * Math.PI) / response, 2);
  const damping = (4 * Math.PI * dampingRatio) / response;
  return { mass: 1, stiffness, damping };
}

/**
 * House springs. Critically damped by default; overshoot is reserved for
 * motion that follows a gesture carrying real momentum (a flicked sheet).
 */
export const springs = {
  /** Press feedback: fast enough to land inside the touch. */
  press: spring(0.18, 1),
  /** Default for anything that moves without a gesture behind it. */
  settle: spring(0.38, 1),
  /** Larger repositioning: segmented thumb, card settle. */
  move: spring(0.4, 1),
  /** Sheet or drawer released from a drag. */
  sheet: spring(0.3, 0.8),
  /** Sheet opened or closed by a button: same speed, no bounce. */
  sheetProgrammatic: spring(0.34, 1),
  /** Rotation and tilt returning to rest. */
  tilt: spring(0.4, 0.8),
} as const;

/**
 * Where a flick will come to rest, using scroll-style exponential decay.
 * Returns the extra distance in points for a release velocity in points/sec.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Progressive resistance past a boundary. The further the overshoot, the less
 * the element follows, so an edge reads as "nothing more here" not "frozen".
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** The snap point nearest a (projected) position. */
export function nearest(position: number, points: readonly number[]): number {
  'worklet';
  let best = points[0] ?? position;
  let bestDistance = Math.abs(position - best);
  for (let i = 1; i < points.length; i++) {
    const point = points[i] as number;
    const distance = Math.abs(position - point);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}
