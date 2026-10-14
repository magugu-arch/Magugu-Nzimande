'use client';

import { useEffect } from 'react';

/**
 * One IntersectionObserver for the whole site. Elements marked `data-reveal`
 * fade up once as they enter the viewport. Nothing is hidden until this has
 * mounted, so without JavaScript (or before hydration) everything is simply
 * there. A MutationObserver picks up elements that arrive later — client
 * navigations, filtered lists — so nothing can be left invisible.
 */
export function RevealObserver() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );

    const watch = (scope: ParentNode) => {
      const found = scope.querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])');
      found.forEach((el) => {
        // Stagger siblings in a group so a row of cards arrives in sequence.
        const group = el.parentElement?.closest('[data-reveal-group]');
        if (group) {
          const index = Array.from(group.querySelectorAll('[data-reveal]')).indexOf(el);
          el.style.setProperty('--reveal-delay', `${Math.min(Math.max(index, 0), 6) * 70}ms`);
        }
        io.observe(el);
      });
    };

    watch(document);
    document.documentElement.setAttribute('data-reveal-ready', '');

    const mo = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches('[data-reveal]:not([data-revealed])')) io.observe(node);
          watch(node);
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
