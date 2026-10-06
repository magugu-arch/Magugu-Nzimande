'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * One observer for the whole site: anything marked `data-reveal` gains
 * `is-revealed` as it enters the viewport. CSS does the animating, and only
 * when motion is allowed (see globals.css), so pages work without it.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    const watch = () => {
      document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach((el) => observer.observe(el));
    };
    watch();

    // Content streamed in after the first paint (suspense boundaries, client
    // navigations) gets picked up too.
    const mutations = new MutationObserver(watch);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [pathname]);

  return null;
}
