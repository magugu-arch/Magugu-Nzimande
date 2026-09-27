import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { useLocation, useOutlet } from 'react-router';
import { ButtonLink } from '../ui/Button';
import { BackToTop } from './BackToTop';
import { Footer } from './Footer';
import { Header } from './Header';

/** Pages where a floating "Book" bar would compete with the page's own action. */
const NO_STICKY_CTA = ['/booking', '/payment', '/confirmation'];

export function Layout() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, location.hash]);

  const showCta = !NO_STICKY_CTA.some((p) => location.pathname.startsWith(p));

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain min-h-dvh">
        <Header />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            id="main"
            key={location.pathname}
            tabIndex={-1}
            className="outline-none"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {outlet}
          </motion.main>
        </AnimatePresence>
        <Footer />
        <BackToTop />

        {showCta && (
          <nav aria-label="Quick booking" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
            <ButtonLink to="/booking" className="w-full" arrow>
              Book a Consultation
            </ButtonLink>
          </nav>
        )}
      </div>
    </MotionConfig>
  );
}
