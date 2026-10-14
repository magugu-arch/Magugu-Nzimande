'use client';

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import Link from 'next/link';
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { primaryCta, primaryNav, verifiedSocials } from '@/content/site';
import { cn } from '@/lib/cn';
import {
  DRAG_THRESHOLD,
  FLICK_VELOCITY,
  type Sample,
  clamp,
  pushSample,
  rubberband,
  shouldDismiss,
  springs,
  velocityFromSamples,
} from '@/lib/motion';
import { CloseIcon, SearchIcon, TikTokIcon } from '../ui/icons';

const secondaryLinks = [
  { label: 'Speaking', href: '/speaking' },
  { label: 'Insights', href: '/insights' },
  { label: 'Press', href: '/press' },
  { label: 'Member login', href: '/login' },
];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
  abandoned: boolean;
  originValue: number;
  originPointer: number;
  samples: Sample[];
}

/**
 * The mobile menu: a full-height sheet from the right. It enters and leaves
 * along the same path, follows the finger 1:1 when dragged, resists being
 * pulled past open, and decides close-or-stay from where the flick is going.
 * It can be grabbed mid-animation and redirected. Escape, the scrim and the
 * close button all dismiss it; focus is trapped inside while open and
 * returned to the menu button after.
 */
export function MobileDrawer({
  open,
  onClose,
  returnFocusTo,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusTo: RefObject<HTMLElement | null>;
  pathname: string;
}) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const widthRef = useRef(420);
  const releaseVelocity = useRef(0);
  const gesture = useRef<Gesture | null>(null);
  // A drag ends with a click on whatever is under the finger — swallow only
  // that one, within a short window. A flag would linger when the browser
  // sends no click after a pan, and eat the next real tap.
  const suppressClickUntil = useRef(0);

  const x = useMotionValue(typeof window === 'undefined' ? 1000 : window.innerWidth);
  const fade = useMotionValue(reduced ? 0 : 1);
  // The scrim tracks the panel continuously, so dragging dims and undims live.
  const progress = useTransform(x, (v) => 1 - clamp(v / Math.max(widthRef.current, 1), 0, 1));

  // Enter: measure, start off-screen, spring in — before the first paint.
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    widthRef.current = panelRef.current.offsetWidth;
    if (reduced) {
      x.set(0);
      animate(fade, 1, { duration: 0.2, ease: 'easeOut' });
    } else {
      if (x.get() > widthRef.current) x.set(widthRef.current);
      fade.set(1);
      animate(x, 0, springs.sheet);
    }
  }, [open, reduced, x, fade]);

  // Leave: the same path out, carrying any release velocity, then unmount.
  useEffect(() => {
    if (open || !mounted) return;
    const v = releaseVelocity.current;
    releaseVelocity.current = 0;
    const done = () => setMounted(false);
    const controls = reduced
      ? animate(fade, 0, { duration: 0.16, ease: 'easeIn' })
      : animate(x, widthRef.current, {
          ...(Math.abs(v) > FLICK_VELOCITY ? springs.flick : springs.sheet),
          bounce: 0,
          velocity: v,
        });
    controls.then(done);
    return () => controls.stop();
  }, [open, mounted, reduced, x, fade]);

  // While mounted: lock page scroll, make the page inert, trap focus, Escape closes.
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const shell = document.getElementById('site-shell');
    const scrollbar = window.innerWidth - html.clientWidth;
    const prevOverflow = html.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    html.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    shell?.setAttribute('inert', '');
    closeRef.current?.focus({ preventScroll: true });

    const trigger = returnFocusTo.current;
    return () => {
      html.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
      shell?.removeAttribute('inert');
      trigger?.focus({ preventScroll: true });
    };
  }, [mounted, returnFocusTo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // ---------- Drag to dismiss ----------

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (reduced || (e.pointerType === 'mouse' && e.button !== 0)) return;
      gesture.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        abandoned: false,
        originValue: 0,
        originPointer: e.clientX,
        samples: [{ t: e.timeStamp, v: e.clientX }],
      };
    },
    [reduced],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      if (!g || g.abandoned || e.pointerId !== g.pointerId) return;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      if (!g.dragging) {
        // Vertical intent: let the list scroll and stop considering a drag.
        if (Math.abs(dy) > DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
          g.abandoned = true;
          return;
        }
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        g.dragging = true;
        // Interrupt anything in flight and continue from where it is on screen.
        x.stop();
        g.originValue = x.get();
        g.originPointer = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
      }

      const raw = g.originValue + (e.clientX - g.originPointer);
      // Past fully open, resist progressively instead of stopping dead.
      x.set(raw < 0 ? rubberband(raw, widthRef.current) : raw);
      g.samples = pushSample(g.samples, { t: e.timeStamp, v: e.clientX });
    },
    [x],
  );

  const endGesture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || !g.dragging || e.pointerId !== g.pointerId) return;
      suppressClickUntil.current = e.timeStamp + 250;
      const velocity = velocityFromSamples(g.samples);
      if (shouldDismiss({ offset: x.get(), velocity, distance: widthRef.current })) {
        releaseVelocity.current = velocity;
        onClose();
      } else {
        animate(x, 0, {
          ...(Math.abs(velocity) > FLICK_VELOCITY ? springs.flick : springs.sheet),
          velocity,
        });
      }
    },
    [x, onClose],
  );

  if (!mounted) return null;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return createPortal(
    <div className="fixed inset-0 z-[70] lg:hidden">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[#05070c]/70"
        style={{ opacity: reduced ? fade : progress }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        data-state={open ? 'open' : 'closed'}
        className="grain absolute inset-y-0 right-0 flex w-[min(26rem,100%)] touch-pan-y flex-col overflow-y-auto overscroll-contain bg-charcoal shadow-[-30px_0_80px_-20px_rgb(0_0_0/0.7)]"
        style={{ x, opacity: reduced ? fade : 1 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onClickCapture={(e) => {
          if (e.timeStamp < suppressClickUntil.current) {
            suppressClickUntil.current = 0;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between px-[var(--gutter)]">
          <span className="font-display text-xl font-semibold tracking-[-0.01em]">Menu</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="pressable -mr-2 grid size-11 place-items-center rounded-full text-ivory hover:bg-ivory/10"
          >
            <CloseIcon size={22} />
            <span className="sr-only">Close menu</span>
          </button>
        </div>

        <nav aria-label="Mobile" className="flex-1 px-[var(--gutter)] pt-4 pb-10">
          <ul className="space-y-1">
            {primaryNav.map((item, i) => (
              <li
                key={item.href}
                className="drawer-item"
                style={{ transitionDelay: open ? `${60 + i * 28}ms` : '0ms' }}
              >
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'pressable flex items-center justify-between rounded-lg py-2.5 font-display text-[2rem] leading-tight tracking-[-0.015em]',
                    isActive(item.href) ? 'text-gold-bright' : 'text-ivory hover:text-gold-bright',
                  )}
                >
                  {item.label}
                  {isActive(item.href) ? (
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href={primaryCta.href}
            onClick={onClose}
            className="pressable mt-8 flex h-13 items-center justify-center rounded-full bg-gold font-semibold text-ink"
          >
            {primaryCta.label}
          </Link>

          <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ivory/10 pt-8 type-small">
            {secondaryLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={onClose} className="text-ivory/75 hover:text-ivory">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/search"
                onClick={onClose}
                className="inline-flex items-center gap-2 text-ivory/75 hover:text-ivory"
              >
                <SearchIcon size={16} /> Search
              </Link>
            </li>
            {verifiedSocials.map((s) => (
              <li key={s.platform}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-ivory/75 hover:text-ivory"
                >
                  <TikTokIcon size={16} /> {s.handle}
                  <span className="sr-only"> on {s.platform} (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </motion.div>
    </div>,
    document.body,
  );
}
