import { ArrowLeft, ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Pages with no sensible "previous page": the home page, and the steps a payment gateway returns to. */
const NO_BACK = ['/', '/confirmation', '/payment/mock'];

const button =
  'ui-label inline-flex min-h-11 items-center gap-2 border border-white/40 bg-black/90 px-4 text-white backdrop-blur-sm transition-colors duration-300 hover:bg-white hover:text-black';

/**
 * The two ways back, always to hand: "Back" returns to the previous page, and
 * "Back to top" appears once the visitor has scrolled past the first screen.
 * On phones they sit above the booking bar; on desktop, bottom right.
 */
export function PageNav() {
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function back() {
    // 'default' means this is the first page opened on the site (a shared link,
    // a bookmark), so there is nothing to go back to: go up a level instead.
    if (key !== 'default') navigate(-1);
    else navigate(pathname.split('/').slice(0, -1).join('/') || '/');
  }

  function toTop() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById('main')?.focus({ preventScroll: true });
  }

  const showBack = !NO_BACK.includes(pathname);

  return (
    <nav aria-label="Page navigation" className="pointer-events-none fixed bottom-24 left-3 z-[44] flex gap-2 lg:right-6 lg:bottom-6 lg:left-auto">
      {showBack && (
        <button type="button" onClick={back} className={`${button} pointer-events-auto`}>
          <ArrowLeft aria-hidden className="size-4" /> Back
        </button>
      )}
      {scrolled && (
        <button type="button" onClick={toTop} aria-label="Back to top" className={`${button} pointer-events-auto`}>
          <ArrowUp aria-hidden className="size-4" /> <span className="hidden sm:inline">Back to top</span>
        </button>
      )}
    </nav>
  );
}
