import { ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

/**
 * Motion, in Apple's terms (WWDC 2018, "Designing Fluid Interfaces").
 *
 * A spring is described by its damping ratio (1 = no overshoot) and its
 * response (roughly how long it takes to get there, in seconds) rather than by
 * mass, stiffness and damping. `springConfig` converts those two numbers into
 * the physics Reanimated runs, exactly — unit mass, k = (2π/response)², and
 * c = 4πζ/response — so a value tuned against an iOS prototype carries over.
 *
 * Defaults are critically damped. Bounce is reserved for motion a finger
 * threw: overshoot on a menu that simply appeared reads as wrong; on a sheet
 * you flicked it reads as physical.
 */
export type AppleSpring = { damping: number; response: number };

export const SPRING = {
  /** Anything that moved without being thrown. */
  settle: { damping: 1, response: 0.38 },
  /** A sheet or card a finger has just released with speed. */
  thrown: { damping: 0.86, response: 0.32 },
  /** Small flourishes: a badge counting, a press releasing. */
  snappy: { damping: 1, response: 0.26 },
  /** Press feedback: on the press, and quick. */
  press: { damping: 1, response: 0.18 },
} as const satisfies Record<string, AppleSpring>;

export function springConfig(spring: AppleSpring, velocity = 0): WithSpringConfig {
  'worklet';
  const omega = (2 * Math.PI) / spring.response;
  return {
    mass: 1,
    stiffness: omega * omega,
    damping: 2 * spring.damping * omega,
    velocity,
    // The system setting decides: under Reduce Motion the value jumps and the
    // screen cross-fades instead (see the navigators' animation options).
    reduceMotion: ReduceMotion.System,
  };
}

/**
 * Where a release at `velocity` (points/s) would come to rest — Apple's
 * projection, the same exponential decay a scroll view decelerates with.
 * 0.998 is UIScrollView's normal rate; 0.99 is its fast rate.
 */
export function project(velocity: number, decelerationRate = 0.995): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary — things slow down before they stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  const sign = overshoot < 0 ? -1 : 1;
  const x = Math.abs(overshoot);
  return (sign * (x * dimension * constant)) / (dimension + constant * x);
}

/** The snap point nearest to where the gesture is heading, not where it let go. */
export function nearestSnap(position: number, velocity: number, points: readonly number[]): number {
  'worklet';
  const projected = position + project(velocity);
  let best = points[0] ?? position;
  for (const p of points) if (Math.abs(p - projected) < Math.abs(best - projected)) best = p;
  return best;
}
