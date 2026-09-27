import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * A way back to the top from anywhere on a long page. It appears once the
 * visitor has scrolled past the first screen, and returns focus to the page
 * start so keyboard and screen-reader users land in the same place.
 */
export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function toTop() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById('main')?.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      className={`ui-label fixed bottom-24 left-3 z-[44] inline-flex min-h-11 items-center gap-2 border border-white/40 bg-black/90 px-4 text-white backdrop-blur-sm transition-[opacity,transform] duration-300 hover:bg-white hover:text-black lg:right-6 lg:bottom-6 lg:left-auto ${
        shown ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUp aria-hidden className="size-4" /> <span className="hidden sm:inline">Back to top</span>
    </button>
  );
}
