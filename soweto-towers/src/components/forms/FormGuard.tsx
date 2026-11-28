'use client';

import { useEffect, useRef } from 'react';

/**
 * Spam guard for public forms: a hidden field only bots fill in, and the time
 * the form appeared (see looksLikeBot). The time is written after mount,
 * straight to the input, so the page stays prerendered and nothing re-renders.
 *
 * "Appeared" means when the page's HTML arrived, not when React took over: a
 * visitor can see and fill the form before the JavaScript finishes loading, and
 * an early tap is held and replayed on hydration (see boot-script.ts). For a
 * form reached by in-app navigation later on, it's the moment it mounted.
 */
export function FormGuard() {
  const startedAt = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const sinceHtml = nav ? performance.now() - nav.responseEnd : Infinity;
    const shown = sinceHtml < 60_000 ? performance.timeOrigin + (nav?.responseEnd ?? 0) : Date.now();
    if (startedAt.current) startedAt.current.value = String(Math.round(shown));
  }, []);
  return (
    <>
      <input type="text" name="company_website" className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden />
      <input ref={startedAt} type="hidden" name="started_at" defaultValue="" />
    </>
  );
}
