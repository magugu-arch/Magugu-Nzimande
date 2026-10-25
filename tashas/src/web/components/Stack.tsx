/**
 * A navigation stack with iOS behaviour: pages push in from the right, the
 * page beneath slides a little left and dims, and a swipe from the left edge
 * drags the top page back 1:1. Release projects the flick's momentum and
 * either completes the pop or springs back, carrying the finger's velocity.
 * A page caught mid-animation is grabbed from where it is on screen.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { SPRING, SpringValue, VelocityTracker, prefersReducedMotion, project, rubberband } from '../motion/spring.ts';
import type { Route, Tab } from '../nav.ts';
import { pop } from '../nav.ts';

const PARALLAX = 0.28;
const EDGE = 26;

type Role = 'top' | 'below' | 'hidden' | 'exiting';

interface Registry {
  springs: Map<number, SpringValue>;
  width: () => number;
  handoff: number | null;
}

function routeKey(route: Route, index: number): string {
  return `${index}:${route.name}:${'id' in route ? route.id : 'slug' in route ? route.slug : ''}`;
}

export function StackView({
  tab,
  stack,
  lastKind,
  render,
  active,
}: {
  tab: Tab;
  stack: Route[];
  lastKind: 'push' | 'pop' | 'none';
  render: (route: Route) => ComponentChildren;
  active: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const registry = useRef<Registry>({
    springs: new Map(),
    width: () => hostRef.current?.clientWidth ?? window.innerWidth,
    handoff: null,
  });
  const prev = useRef<Route[]>(stack);
  const [exiting, setExiting] = useState<{ route: Route; index: number }[]>([]);

  useLayoutEffect(() => {
    const before = prev.current;
    if (stack.length < before.length) {
      const gone = before.slice(stack.length).map((route, i) => ({ route, index: stack.length + i }));
      // Only the page that was on top animates out; anything above it simply goes.
      setExiting((x) => [...x, gone[gone.length - 1]!]);
    }
    prev.current = stack;
  }, [stack]);

  const pages: { route: Route; index: number; role: Role }[] = stack.map((route, index) => ({
    route,
    index,
    role: index === stack.length - 1 ? 'top' : index === stack.length - 2 ? 'below' : 'hidden',
  }));
  for (const e of exiting) {
    if (!pages.some((p) => p.index === e.index)) pages.push({ ...e, role: 'exiting' });
  }
  return (
    <div class="tabstack" ref={hostRef} data-tab={tab} hidden={!active}>
      {pages.map((p) => (
        <Page
          key={routeKey(p.route, p.index)}
          index={p.index}
          role={p.role}
          animateIn={lastKind === 'push' && p.index > 0}
          registry={registry.current}
          onExited={() => setExiting((x) => x.filter((e) => e.index !== p.index))}
        >
          {render(p.route)}
        </Page>
      ))}
    </div>
  );
}

function Page({
  index,
  role,
  animateIn,
  registry,
  onExited,
  children,
}: {
  index: number;
  role: Role;
  animateIn: boolean;
  registry: Registry;
  onExited: () => void;
  children: ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const spring = useRef<SpringValue | null>(null);
  const firstRole = useRef(role);

  if (!spring.current) {
    spring.current = new SpringValue(0, (x) => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = x === 0 ? '' : `translate3d(${x}px,0,0)`;
      if (dimRef.current) {
        const w = registry.width();
        dimRef.current.style.opacity = x < 0 ? String(Math.min(0.1, (-x / (w * PARALLAX)) * 0.1)) : '0';
      }
      el.style.boxShadow = x > 0 ? '-12px 0 32px -12px rgba(0,0,0,0.28)' : '';
    });
  }

  useEffect(() => {
    registry.springs.set(index, spring.current!);
    return () => {
      registry.springs.delete(index);
    };
  }, [index, registry]);

  // Enter: from the right edge, unless reduced motion asks for a fade.
  useLayoutEffect(() => {
    const s = spring.current!;
    if (firstRole.current === 'top' && animateIn) {
      if (prefersReducedMotion()) {
        ref.current?.classList.add('enter');
        return;
      }
      s.set(registry.width());
      s.to(0, { params: SPRING.push });
    }
  }, []);

  // Role changes drive the motion; every animation starts from the current value.
  const lastRole = useRef(role);
  useLayoutEffect(() => {
    const s = spring.current!;
    const was = lastRole.current;
    lastRole.current = role;
    if (was === role) return;
    const w = registry.width();
    const velocity = registry.handoff ?? undefined;
    if (role === 'below') s.to(-w * PARALLAX, { params: SPRING.push });
    else if (role === 'top') s.to(0, { params: SPRING.push, ...(velocity !== undefined ? { velocity: velocity * PARALLAX } : {}) });
    else if (role === 'exiting') {
      registry.handoff = null;
      if (prefersReducedMotion()) {
        onExited();
        return;
      }
      s.to(w, { params: SPRING.push, ...(velocity !== undefined ? { velocity } : {}), onRest: onExited });
    }
  }, [role]);

  // Interactive edge swipe back.
  useEffect(() => {
    const el = ref.current;
    if (!el || index === 0) return;
    const tracker = new VelocityTracker();
    let start: { x: number; y: number; value: number; below: number } | null = null;
    let engaged = false;
    let pointerId = -1;

    const down = (e: PointerEvent) => {
      if (lastRole.current !== 'top' || e.button > 0) return;
      const left = el.getBoundingClientRect().left;
      const s = spring.current!;
      // Grab from the edge, or catch a page that is still sliding.
      if (e.clientX - left > EDGE && !s.animating) return;
      s.stop();
      const below = registry.springs.get(index - 1);
      below?.stop();
      start = { x: e.clientX, y: e.clientY, value: s.value, below: below?.value ?? -registry.width() * PARALLAX };
      engaged = false;
      pointerId = e.pointerId;
      tracker.reset();
      tracker.add(s.value);
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!engaged) {
        if (Math.abs(dx) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          start = null;
          return;
        }
        engaged = true;
        el.setPointerCapture(pointerId);
      }
      e.preventDefault();
      const w = registry.width();
      let x = start.value + dx;
      if (x < 0) x = rubberband(x, w);
      spring.current!.set(x);
      tracker.add(x);
      const below = registry.springs.get(index - 1);
      below?.set(-w * PARALLAX + Math.max(0, x) * PARALLAX);
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== pointerId) return;
      const wasEngaged = engaged;
      start = null;
      engaged = false;
      if (!wasEngaged) return;
      const w = registry.width();
      const v = tracker.velocity();
      const s = spring.current!;
      const landing = s.value + project(v);
      if (landing > w / 2 && v > -200) {
        registry.handoff = v;
        pop();
      } else {
        s.to(0, { params: SPRING.push, velocity: v });
        registry.springs.get(index - 1)?.to(-w * PARALLAX, { params: SPRING.push, velocity: v * PARALLAX });
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move, { passive: false });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [index, registry]);

  return (
    <div
      ref={ref}
      class={`page ${role === 'below' || role === 'exiting' ? 'below' : ''}`}
      hidden={role === 'hidden'}
      aria-hidden={role === 'top' ? undefined : 'true'}
      inert={role === 'top' ? undefined : true}
      style={{ zIndex: index + 1, touchAction: index > 0 ? 'pan-y' : undefined }}
    >
      {children}
      <div class="page-dim" ref={dimRef} />
    </div>
  );
}
