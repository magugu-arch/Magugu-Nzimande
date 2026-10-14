/**
 * The physics behind every gesture on the site, kept free of React so it can
 * be tested. The numbers follow Apple's "Designing Fluid Interfaces" talk:
 * project a flick forward the way scrolling decelerates, resist at the edges
 * instead of stopping dead, and hand the finger's velocity to the spring.
 */

/**
 * Distance a flick will travel before it comes to rest, using the same
 * exponential decay as scroll deceleration (not v²/2a).
 * @param velocity px/s at release
 * @param decelerationRate 0.998 is normal scroll feel, 0.99 is snappier
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Progressive resistance past a boundary: the further past it, the less the
 * element follows the pointer. Never reaches `dimension`.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0 || overshoot === 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface Sample {
  /** ms, from PointerEvent.timeStamp */
  t: number;
  /** px */
  v: number;
}

/**
 * Release velocity in px/s from the recent pointer history. Uses samples from
 * the last 100ms so a pause before letting go reads as zero, not as the speed
 * of a movement that already ended.
 */
export function velocityFromSamples(samples: readonly Sample[], windowMs = 100): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    const s = samples[i]!;
    if (last.t - s.t > windowMs) break;
    first = s;
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return ((last.v - first.v) / dt) * 1000;
}

/** Keep a short, bounded history; enough for velocity, never a leak. */
export function pushSample(samples: Sample[], sample: Sample, max = 8): Sample[] {
  const next = samples.length >= max ? samples.slice(samples.length - max + 1) : samples.slice();
  next.push(sample);
  return next;
}

/**
 * Index to land on after a horizontal swipe through pages of width `width`.
 * The decision uses where the flick is *going*, and moves at most one page
 * from where the gesture began, as the Photos app does.
 */
export function landingIndex(options: {
  offset: number;
  velocity: number;
  width: number;
  startIndex: number;
  count: number;
}): number {
  const { offset, velocity, width, startIndex, count } = options;
  if (width <= 0 || count <= 0) return 0;
  const projected = offset + project(velocity);
  const raw = Math.round(-projected / width);
  return clamp(clamp(raw, startIndex - 1, startIndex + 1), 0, count - 1);
}

/**
 * Whether a drag towards dismissal should commit. Driven by the projected
 * resting point, so a short fast flick dismisses and a long slow drag that
 * is let go of halfway does not, unless it is already past `threshold`.
 */
export function shouldDismiss(options: {
  offset: number;
  velocity: number;
  distance: number;
  threshold?: number;
}): boolean {
  const { offset, velocity, distance, threshold = 0.5 } = options;
  if (distance <= 0) return false;
  // Moving back towards the origin with any real speed is a clear "no".
  if (velocity < -150) return false;
  return offset + project(velocity) > distance * threshold;
}

/**
 * Spring presets in Motion's terms. `visualDuration` plays the role of
 * Apple's "response"; `bounce` is 1 − damping ratio. Critically damped by
 * default; a little bounce only when a flick put momentum into the motion.
 */
export const springs = {
  /** Moving things into place: no overshoot. */
  settle: { type: 'spring', bounce: 0, visualDuration: 0.4 },
  /** Sheets and drawers. */
  sheet: { type: 'spring', bounce: 0, visualDuration: 0.32 },
  /** After a flick: momentum earns a touch of overshoot (≈ damping 0.82). */
  flick: { type: 'spring', bounce: 0.18, visualDuration: 0.32 },
} as const;

/** Release speeds above this (px/s) count as a flick. */
export const FLICK_VELOCITY = 400;

/** Movement (px) before a press becomes a drag: taps on links stay taps. */
export const DRAG_THRESHOLD = 10;
