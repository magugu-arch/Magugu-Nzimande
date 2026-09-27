import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { WorkItem } from '../../data/work';
import { Picture } from '../ui/Picture';

/**
 * Accessible large-image viewer: a modal dialog that traps focus, closes on
 * Escape or the close button, pages with the arrow keys, and returns focus to
 * whatever opened it.
 */
export function Lightbox({ items, index, onClose, onIndex }: { items: WorkItem[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const open = index !== null;
  const item = open ? items[index] : undefined;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('[data-close]')?.focus();
    return () => {
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onIndex((index + 1) % items.length);
      else if (e.key === 'ArrowLeft') onIndex((index - 1 + items.length) % items.length);
      else if (e.key === 'Tab' && ref.current) {
        const els = [...ref.current.querySelectorAll<HTMLElement>('button')];
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, items.length, onClose, onIndex]);

  return (
    <AnimatePresence>
      {item && index !== null && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={`${item.title}, image ${index + 1} of ${items.length}`}
          className="fixed inset-0 z-[80] flex flex-col bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="page-gutter flex h-16 shrink-0 items-center justify-between">
            <p className="ui-label opacity-70">
              {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')} — {item.title}
            </p>
            <button type="button" data-close onClick={onClose} className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center gap-3">
              <span className="ui-label">Close</span>
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6">
            <motion.div key={item.slug} className="h-full" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <Picture image={item.image} sizes="100vw" className="h-full" imgClassName="!object-contain" />
            </motion.div>
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onIndex((index - 1 + items.length) % items.length)}
                  aria-label="Previous image"
                  className="absolute left-1 inline-flex min-h-11 min-w-11 items-center justify-center md:left-4"
                >
                  <ChevronLeft aria-hidden className="size-7" />
                </button>
                <button
                  type="button"
                  onClick={() => onIndex((index + 1) % items.length)}
                  aria-label="Next image"
                  className="absolute right-1 inline-flex min-h-11 min-w-11 items-center justify-center md:right-4"
                >
                  <ChevronRight aria-hidden className="size-7" />
                </button>
              </>
            )}
          </div>
          <p className="page-gutter pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center font-serif italic opacity-80">{item.summary}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
