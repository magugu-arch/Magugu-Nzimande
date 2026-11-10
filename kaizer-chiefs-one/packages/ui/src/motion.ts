/**
 * Motion tokens, expressed the way Apple's fluid-interface work does: a
 * damping ratio (1 = no overshoot) and a response in seconds (how quickly the
 * value reaches its target). A spring has no fixed duration.
 *
 * Default to critically damped. Use the bouncier specs only when the gesture
 * itself carried momentum (a flick, a drag release).
 */
export interface SpringSpec {
  dampingRatio: number;
  response: number;
}

export const spring = {
  /** Default for anything that moves into place. */
  standard: { dampingRatio: 1, response: 0.4 },
  /** Press feedback, toggles, selection pills. */
  snappy: { dampingRatio: 1, response: 0.25 },
  /** Sheets and drawers released by a drag. */
  sheet: { dampingRatio: 0.85, response: 0.32 },
  /** A card flicked or thrown. */
  momentum: { dampingRatio: 0.8, response: 0.4 },
} as const satisfies Record<string, SpringSpec>;

export type SpringToken = keyof typeof spring;

/**
 * Convert damping ratio + response to the mass/stiffness/damping triplet
 * used by Reanimated and most web spring libraries (mass = 1).
 *
 *   stiffness = (2π / response)²
 *   damping   = 4π · ζ / response
 */
export function toPhysicalSpring(spec: SpringSpec, mass = 1) {
  const stiffness = Math.pow((2 * Math.PI) / spec.response, 2) * mass;
  const damping = (4 * Math.PI * spec.dampingRatio * mass) / spec.response;
  return {
    mass,
    stiffness: Math.round(stiffness * 100) / 100,
    damping: Math.round(damping * 100) / 100,
  };
}

/** Durations for the few things that are not springs (fades, colour). */
export const duration = {
  instant: 100,
  quick: 180,
  standard: 260,
  slow: 420,
} as const;

/**
 * Apple's momentum projection: where a flick will come to rest.
 * decelerationRate 0.998 matches normal scrolling; 0.99 is snappier.
 */
export function projectMomentum(velocityPerSecond: number, decelerationRate = 0.998): number {
  return ((velocityPerSecond / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary, instead of a hard stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
