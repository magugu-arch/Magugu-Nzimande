'use client';

import { type RefObject, useEffect } from 'react';

/**
 * Parallax for photographs.
 *
 * Browsers with scroll-driven animations do all of it in CSS
 * (`Photo.module.css`), off the main thread. This file is the fallback for the
 * rest: one passive scroll listener, one animation frame per scroll, and only
 * the frames that are on screen are measured. It writes a single custom
 * property, `--parallax`, that the stylesheet turns into a transform.
 */

/** −1 as the frame enters at the bottom of the screen, 0 mid-way, 1 as it leaves at the top. */
export function parallaxValue(frameBottom: number, frameHeight: number, viewport: number): number {
  const travel = viewport + frameHeight;
  if (travel <= 0) return 0;
  const progress = 1 - frameBottom / travel;
  return Math.max(-1, Math.min(1, progress * 2 - 1));
}

function supportsScrollTimelines(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timeline: view()')
  );
}

interface ParallaxController {
  add: (element: HTMLElement) => () => void;
}

let controller: ParallaxController | null = null;

function createController(): ParallaxController {
  const onScreen = new Set<HTMLElement>();
  let frame = 0;

  const measure = () => {
    frame = 0;
    const viewport = window.innerHeight;
    for (const element of onScreen) {
      const rect = element.getBoundingClientRect();
      element.style.setProperty(
        '--parallax',
        parallaxValue(rect.bottom, rect.height, viewport).toFixed(3),
      );
    }
  };
  const schedule = () => {
    if (frame === 0 && onScreen.size > 0) frame = requestAnimationFrame(measure);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          onScreen.add(element);
          element.dataset.inView = '';
        } else {
          onScreen.delete(element);
          delete element.dataset.inView;
        }
      }
      schedule();
    },
    { rootMargin: '10% 0px' },
  );

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  document.documentElement.dataset.parallax = 'js';

  return {
    add(element) {
      observer.observe(element);
      return () => {
        observer.unobserve(element);
        onScreen.delete(element);
        delete element.dataset.inView;
      };
    },
  };
}

/** Registers a photograph frame for the scripted fallback. Does nothing where CSS can do it. */
export function useParallax(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    if (supportsScrollTimelines() || typeof IntersectionObserver === 'undefined') return;
    controller ??= createController();
    return controller.add(element);
  }, [ref, enabled]);
}
