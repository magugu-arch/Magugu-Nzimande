/**
 * Springs, the way Apple parameterises them: a damping ratio (1 = no
 * overshoot) and a response in seconds, rather than mass/stiffness/damping.
 *
 * A SpringValue always animates from where it is now, at the velocity it has
 * now, so a gesture can grab it mid-flight and a new target never causes a
 * jump or a velocity "brick wall". Drag sets the value directly; release
 * hands the finger's velocity to the spring.
 */

export interface SpringParams {
  response: number;
  dampingRatio: number;
}

/** Defaults from Apple's Designing Fluid Interfaces. */
export const SPRING = {
  /** UI that just moves: no bounce. */
  default: { response: 0.4, dampingRatio: 1 } as SpringParams,
  /** Sheets and drawers after a flick: a little life. */
  sheet: { response: 0.32, dampingRatio: 0.86 } as SpringParams,
  /** Sheets settling without momentum. */
  sheetCalm: { response: 0.34, dampingRatio: 1 } as SpringParams,
  /** Push/pop navigation. */
  push: { response: 0.36, dampingRatio: 1 } as SpringParams,
  snappy: { response: 0.28, dampingRatio: 1 } as SpringParams,
};

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export class SpringValue {
  value: number;
  velocity = 0;
  target: number;
  private params: SpringParams = SPRING.default;
  private raf = 0;
  private last = 0;
  private onUpdate: (v: number) => void;
  private onRest: (() => void) | null = null;

  constructor(initial: number, onUpdate: (v: number) => void) {
    this.value = initial;
    this.target = initial;
    this.onUpdate = onUpdate;
  }

  get animating(): boolean {
    return this.raf !== 0;
  }

  /** Jump without animation (dragging, or reduced motion). */
  set(v: number): void {
    this.stop();
    this.value = v;
    this.target = v;
    this.velocity = 0;
    this.onUpdate(v);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /**
   * Re-targets from the current value. `velocity` (units/s) replaces the
   * current velocity only when given, e.g. the finger's speed at release.
   */
  to(target: number, opts: { params?: SpringParams; velocity?: number; onRest?: () => void } = {}): void {
    this.target = target;
    if (opts.params) this.params = opts.params;
    if (opts.velocity !== undefined) this.velocity = opts.velocity;
    this.onRest = opts.onRest ?? null;
    if (prefersReducedMotion()) {
      this.set(target);
      this.onRest?.();
      return;
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number): void => {
    // Clamp the step so a backgrounded tab does not explode the integration.
    let dt = Math.min(0.064, (now - this.last) / 1000);
    this.last = now;
    const { response, dampingRatio } = this.params;
    const k = (2 * Math.PI / response) ** 2;
    const c = (4 * Math.PI * dampingRatio) / response;
    // Semi-implicit Euler in small sub-steps is stable for these stiffnesses.
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      const force = -k * (this.value - this.target) - c * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
      dt -= h;
    }
    const settled = Math.abs(this.velocity) < 4 && Math.abs(this.value - this.target) < 0.25;
    if (settled) {
      this.value = this.target;
      this.velocity = 0;
      this.raf = 0;
      this.onUpdate(this.value);
      const rest = this.onRest;
      this.onRest = null;
      rest?.();
      return;
    }
    this.onUpdate(this.value);
    this.raf = requestAnimationFrame(this.tick);
  };
}

/** Keeps the last ~100 ms of pointer samples to measure release velocity. */
export class VelocityTracker {
  private samples: { t: number; v: number }[] = [];

  reset(): void {
    this.samples = [];
  }

  add(v: number, t = performance.now()): void {
    this.samples.push({ t, v });
    const cutoff = t - 100;
    while (this.samples.length > 2 && this.samples[0]!.t < cutoff) this.samples.shift();
  }

  /** Units per second. */
  velocity(): number {
    const s = this.samples;
    if (s.length < 2) return 0;
    const first = s[0]!;
    const last = s[s.length - 1]!;
    const dt = (last.t - first.t) / 1000;
    return dt > 0 ? (last.v - first.v) / dt : 0;
  }
}

/**
 * Where a flick would come to rest under scroll-like deceleration
 * (Apple's projection from the Designing Fluid Interfaces sample code).
 */
export function project(velocity: number, decelerationRate = 0.99): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary: responsive, but clearly the end. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  const sign = Math.sign(overshoot);
  const x = Math.abs(overshoot);
  return (sign * (x * dimension * constant)) / (dimension + constant * x);
}

/** One short haptic tick where the platform allows it (Android); silent elsewhere. */
export function tick(pattern: number | number[] = 8): void {
  try {
    if (!prefersReducedMotion()) navigator.vibrate?.(pattern);
  } catch {
    /* not available in this frame */
  }
}
