/**
 * Sheets: a modal task layer. On phones it rises from the bottom and the page
 * behind recedes; on desktop it slides in from the right. It tracks the finger
 * 1:1 from wherever it is (even mid-animation), rubber-bands past fully open,
 * and on release projects momentum to decide between dismissing and settling,
 * handing the release velocity to the spring. It leaves the way it came.
 */

import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useContext, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { SPRING, SpringValue, VelocityTracker, prefersReducedMotion, project, rubberband } from '../motion/spring.ts';
import { closeSheet, removeSheet } from '../nav.ts';
import { Icon } from './Icon.tsx';

const SheetCtx = createContext<{ close: () => void; key: number }>({ close: () => {}, key: 0 });
export const useSheet = () => useContext(SheetCtx);

function isDesktop(): boolean {
  try {
    return matchMedia('(min-width: 1024px)').matches;
  } catch {
    return false;
  }
}

export function SheetFrame({
  sheetKey,
  closing,
  depth,
  label,
  compact,
  children,
}: {
  sheetKey: number;
  closing: boolean;
  depth: number;
  label: string;
  compact?: boolean;
  children: ComponentChildren;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const spring = useRef<SpringValue | null>(null);
  const axis = useRef<'x' | 'y'>(isDesktop() ? 'x' : 'y');
  const releaseVelocity = useRef<number | undefined>(undefined);
  const opener = useRef<Element | null>(null);

  const closedOffset = () => {
    const el = sheetRef.current;
    if (!el) return 800;
    return axis.current === 'y' ? el.offsetHeight + 24 : el.offsetWidth + 40;
  };

  if (!spring.current) {
    spring.current = new SpringValue(2000, (v) => {
      const el = sheetRef.current;
      if (!el) return;
      el.style.transform = axis.current === 'y' ? `translate3d(0,${v}px,0)` : `translate3d(${v}px,0,0)`;
      const p = Math.max(0, Math.min(1, 1 - v / closedOffset()));
      if (scrimRef.current) scrimRef.current.style.opacity = String(p);
      if (depth === 0) {
        const app = document.querySelector<HTMLElement>('.app');
        app?.style.setProperty('--sheet-p', String(p));
      }
    });
  }

  useLayoutEffect(() => {
    opener.current = document.activeElement;
    const s = spring.current!;
    if (depth === 0) document.querySelector('.app')?.classList.add('sheet-open');
    if (prefersReducedMotion()) {
      s.set(0);
      sheetRef.current?.classList.add('enter');
    } else {
      s.set(closedOffset());
      s.to(0, { params: SPRING.sheetCalm });
    }
    // Move focus into the dialog for keyboard and screen reader users.
    window.setTimeout(() => {
      const target = sheetRef.current?.querySelector<HTMLElement>('[data-autofocus], h2, button, input');
      target?.focus({ preventScroll: true });
    }, 30);
    return () => {
      if (depth === 0) {
        const app = document.querySelector<HTMLElement>('.app');
        app?.classList.remove('sheet-open');
        app?.style.removeProperty('--sheet-p');
      }
      (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!closing) return;
    const s = spring.current!;
    const v = releaseVelocity.current;
    releaseVelocity.current = undefined;
    if (prefersReducedMotion()) {
      removeSheet(sheetKey);
      return;
    }
    s.to(closedOffset(), { params: SPRING.sheetCalm, ...(v !== undefined ? { velocity: v } : {}), onRest: () => removeSheet(sheetKey) });
  }, [closing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closing) {
        const sheets = document.querySelectorAll('.sheet');
        if (sheets[sheets.length - 1] === sheetRef.current) closeSheet(sheetKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closing]);

  // Drag to dismiss.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const tracker = new VelocityTracker();
    let start: { p: number; q: number; value: number; handle: boolean } | null = null;
    let engaged = false;
    let pointerId = -1;
    const along = (e: PointerEvent) => (axis.current === 'y' ? e.clientY : e.clientX);
    const across = (e: PointerEvent) => (axis.current === 'y' ? e.clientX : e.clientY);

    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [data-no-drag]')) return;
      const handle = !!target.closest('[data-drag-handle]');
      const body = target.closest<HTMLElement>('.sheet-body');
      // From the body, only when its content is scrolled to the top.
      if (!handle && body && body.scrollTop > 0) return;
      if (!handle && axis.current === 'x') return;
      const s = spring.current!;
      s.stop();
      start = { p: along(e), q: across(e), value: s.value, handle };
      engaged = false;
      pointerId = e.pointerId;
      tracker.reset();
      tracker.add(s.value);
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== pointerId) return;
      const d = along(e) - start.p;
      const cross = across(e) - start.q;
      if (!engaged) {
        const threshold = start.handle ? 4 : 10;
        if (Math.abs(d) < threshold) return;
        if (Math.abs(cross) > Math.abs(d) || (!start.handle && d < 0)) {
          start = null;
          return;
        }
        engaged = true;
        el.setPointerCapture(pointerId);
      }
      e.preventDefault();
      let v = start.value + d;
      if (v < 0) v = rubberband(v, closedOffset());
      spring.current!.set(v);
      tracker.add(v);
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== pointerId) return;
      const wasEngaged = engaged;
      start = null;
      engaged = false;
      if (!wasEngaged) return;
      const s = spring.current!;
      const v = tracker.velocity();
      const landing = s.value + project(v);
      if (landing > closedOffset() * 0.45 && v > -300) {
        releaseVelocity.current = v;
        closeSheet(sheetKey);
      } else {
        // Bounce only when the gesture itself carried momentum.
        s.to(0, { params: Math.abs(v) > 300 ? SPRING.sheet : SPRING.sheetCalm, velocity: v });
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
  }, []);

  return (
    <SheetCtx.Provider value={{ close: () => closeSheet(sheetKey), key: sheetKey }}>
      <div class="sheet-layer" style={{ zIndex: 80 + depth * 2 }}>
        <div class="scrim" ref={scrimRef} onClick={() => closeSheet(sheetKey)} aria-hidden="true" />
        <div
          class={`sheet ${compact ? 'compact' : ''}`}
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          style={{ transform: 'translate3d(0,100vh,0)' }}
        >
          <div class="sheet-grabber" data-drag-handle aria-hidden="true" />
          {children}
        </div>
      </div>
    </SheetCtx.Provider>
  );
}

export function SheetHead({ title, sub, leading }: { title: string; sub?: ComponentChildren; leading?: ComponentChildren }) {
  const { close } = useSheet();
  return (
    <div class="sheet-head" data-drag-handle>
      <div class="row" style={{ gap: '8px' }}>
        {leading}
        <div class="stack-sm grow">
          <h2 class="title-2" tabIndex={-1} data-autofocus>
            {title}
          </h2>
          {sub ? <span class="footnote">{sub}</span> : null}
        </div>
      </div>
      <button type="button" class="iconbtn" aria-label="Close" onClick={close} style={{ background: 'color-mix(in srgb, var(--ink) 7%, transparent)', width: '32px', height: '32px' }}>
        <Icon name="close" size={17} />
      </button>
    </div>
  );
}
