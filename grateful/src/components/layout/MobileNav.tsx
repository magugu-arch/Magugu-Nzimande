import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { nav, site } from '../../data/site';
import { ButtonLink } from '../ui/Button';
import { Logo } from '../ui/Logo';

/** Full-screen navigation for small screens. Traps focus and closes on Escape. */
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('button, a')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="page-gutter fixed inset-0 z-[55] flex flex-col bg-black pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden"
          initial={reduce ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
          animate={reduce ? { opacity: 1 } : { clipPath: 'inset(0 0 0% 0)' }}
          exit={reduce ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex h-16 items-center justify-between">
            <Link to="/" aria-label="Grateful — home" className="-m-2 flex min-h-11 items-center p-2" onClick={onClose}>
              <Logo className="h-7" />
            </Link>
            <button type="button" onClick={onClose} className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center gap-3">
              <span className="ui-label">Close</span>
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <nav aria-label="Main" className="mt-10 flex-1">
            <ol className="space-y-1">
              {nav.map((item, i) => (
                <motion.li
                  key={item.to}
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link to={item.to} onClick={onClose} className="flex min-h-14 items-baseline gap-4 border-b border-line py-2">
                    <span className="ui-label w-6 opacity-50">{String(i + 1).padStart(2, '0')}</span>
                    <span className="editorial-title text-5xl">{item.label}</span>
                  </Link>
                </motion.li>
              ))}
            </ol>
          </nav>

          <div className="space-y-5">
            <div className="font-sans text-sm leading-relaxed opacity-70">
              <a href={site.phoneHref} className="block min-h-11 py-2.5">
                {site.phone}
              </a>
              <a href={`mailto:${site.email}`} className="block min-h-11 py-2.5">
                {site.email}
              </a>
            </div>
            <ButtonLink to="/booking" className="w-full" onClick={onClose}>
              Book a Consultation
            </ButtonLink>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
