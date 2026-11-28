'use client';

import { useEffect } from 'react';

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Fades `.reveal` elements up as they scroll into view, including ones that
 * arrive later (client navigation, streamed sections). Uses the Web Animations
 * API rather than toggling a class: the element's attributes never change, so
 * there is nothing for React to see as a hydration mismatch, however early
 * this runs. `--delay` (ms) staggers siblings. Reduced-motion visitors get a
 * short fade with no movement. Without JavaScript nothing is hidden, because
 * the hidden state only applies under `html.js` (see globals.css).
 */
export function RevealObserver() {
  useEffect(() => {
    const done = new WeakSet<Element>();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const show = (el: Element) => {
      if (done.has(el)) return;
      done.add(el);
      const delay = parseFloat(getComputedStyle(el).getPropertyValue('--delay')) || 0;
      const frames: Keyframe[] = reduce.matches
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: 'translate3d(0, 22px, 0)' },
            { opacity: 1, transform: 'none' },
          ];
      el.animate(frames, { duration: reduce.matches ? 300 : 900, delay: reduce.matches ? 0 : delay, easing: EASE_OUT, fill: 'forwards' });
    };

    if (!('IntersectionObserver' in window) || !('animate' in Element.prototype)) {
      document.documentElement.classList.remove('js');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            show(entry.target);
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    const watch = (root: ParentNode) =>
      root.querySelectorAll('.reveal').forEach((el) => {
        if (!done.has(el)) io.observe(el);
      });
    watch(document);
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches('.reveal') && !done.has(node)) io.observe(node);
            watch(node);
          }
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
