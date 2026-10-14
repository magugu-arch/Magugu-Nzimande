'use client';

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import Image from 'next/image';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import {
  DRAG_THRESHOLD,
  FLICK_VELOCITY,
  type Sample,
  clamp,
  landingIndex,
  pushSample,
  rubberband,
  shouldDismiss,
  springs,
  velocityFromSamples,
} from '@/lib/motion';
import { ChevronLeft, ChevronRight, CloseIcon } from '../ui/icons';

export interface GalleryItem {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  focus?: string;
}

type Axis = 'x' | 'y' | null;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  axis: Axis;
  originX: number;
  originY: number;
  startIndex: number;
  samplesX: Sample[];
  samplesY: Sample[];
}

/**
 * A grid of portraits that opens into a full-screen viewer. The viewer grows
 * out of the thumbnail that was pressed and shrinks back into it. Swipe
 * sideways to move between photos (momentum decides where it lands, at most
 * one photo per flick); drag down to dismiss. X and Y run on separate
 * springs. Keyboard: arrows, Home/End, Escape.
 */
export function Gallery({
  items,
  className,
  tone = 'dark',
}: {
  items: GalleryItem[];
  className?: string;
  tone?: 'dark' | 'light';
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <>
      <ul
        data-gallery
        className={cn('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3', className)}
        data-reveal-group
      >
        {items.map((item, i) => (
          <li key={item.src} data-reveal className={cn(i === 0 && 'md:row-span-2')}>
            <button
              ref={(el) => {
                thumbs.current[i] = el;
              }}
              type="button"
              onClick={(e) => {
                setOrigin(e.currentTarget.getBoundingClientRect());
                setOpen(i);
              }}
              className={cn(
                'lift group relative block h-full w-full overflow-hidden rounded-2xl ring-1',
                tone === 'dark' ? 'bg-charcoal ring-ivory/10' : 'bg-stone ring-ink/10',
                i === 0 ? 'aspect-[4/5] md:aspect-auto md:min-h-full' : 'aspect-[4/5]',
              )}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(min-width: 768px) 30vw, 50vw"
                quality={70}
                className="lift-image object-cover"
                style={{ objectPosition: item.focus ?? '50% 30%' }}
              />
              <span className="sr-only">Open larger view</span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null ? (
        <Lightbox
          items={items}
          index={open}
          origin={origin}
          onIndexChange={(i) => {
            setOpen(i);
            setOrigin(thumbs.current[i]?.getBoundingClientRect() ?? null);
          }}
          onClosed={() => setOpen(null)}
          // Runs after the page is interactive again; focusing inside an inert page silently fails.
          returnFocusTo={() => thumbs.current[open]}
        />
      ) : null}
    </>
  );
}

function Lightbox({
  items,
  index,
  origin,
  onIndexChange,
  onClosed,
  returnFocusTo,
}: {
  items: GalleryItem[];
  index: number;
  origin: DOMRect | null;
  onIndexChange: (i: number) => void;
  onClosed: () => void;
  returnFocusTo: () => HTMLElement | null | undefined;
}) {
  const reduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(1);
  const heightRef = useRef(1);
  const gesture = useRef<Gesture | null>(null);
  const closing = useRef(false);
  const focusTarget = useRef(returnFocusTo);
  useEffect(() => {
    focusTarget.current = returnFocusTo;
  });

  const track = useMotionValue(0); // horizontal position of the photo strip
  const dismissY = useMotionValue(0); // vertical drag towards dismissal
  const presence = useMotionValue(0); // 0 → closed, 1 → open
  const scrim = useTransform(() => {
    const drag = clamp(dismissY.get() / (heightRef.current * 0.6), 0, 1);
    return presence.get() * (1 - drag);
  });
  const stageScale = useTransform(() => {
    const p = presence.get();
    const drag = clamp(dismissY.get() / heightRef.current, 0, 1);
    return (0.86 + 0.14 * p) * (1 - drag * 0.25);
  });

  // Grow out of the thumbnail: the transform origin is wherever it was pressed.
  const transformOrigin = (() => {
    if (!origin || typeof window === 'undefined') return '50% 50%';
    const cx = ((origin.left + origin.width / 2) / window.innerWidth) * 100;
    const cy = ((origin.top + origin.height / 2) / window.innerHeight) * 100;
    return `${cx}% ${cy}%`;
  })();

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    widthRef.current = stage.offsetWidth;
    heightRef.current = window.innerHeight;
    track.set(-index * widthRef.current);
    animate(presence, 1, reduced ? { duration: 0.18 } : springs.settle);
    // Only on open; index changes animate below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (next: number, velocity = 0) => {
      const target = clamp(next, 0, items.length - 1);
      if (target !== index) onIndexChange(target);
      if (reduced) {
        track.set(-target * widthRef.current);
        return;
      }
      animate(track, -target * widthRef.current, {
        ...(Math.abs(velocity) > FLICK_VELOCITY ? springs.flick : springs.settle),
        velocity,
      });
    },
    [index, items.length, onIndexChange, reduced, track],
  );

  const close = useCallback(
    (velocity = 0) => {
      if (closing.current) return;
      closing.current = true;
      const done = () => onClosed();
      if (reduced) {
        animate(presence, 0, { duration: 0.15 }).then(done);
        return;
      }
      animate(presence, 0, { ...springs.sheet, velocity: -Math.abs(velocity) / 1000 }).then(done);
    },
    [onClosed, presence, reduced],
  );

  // Keyboard, focus trap, scroll lock, inert page.
  useEffect(() => {
    const html = document.documentElement;
    const shell = document.getElementById('site-shell');
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    shell?.setAttribute('inert', '');
    closeRef.current?.focus({ preventScroll: true });

    const onResize = () => {
      if (!stageRef.current) return;
      widthRef.current = stageRef.current.offsetWidth;
      heightRef.current = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    return () => {
      html.style.overflow = prev;
      shell?.removeAttribute('inert');
      window.removeEventListener('resize', onResize);
      focusTarget.current()?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(items.length - 1);
      } else if (e.key === 'Tab' && dialogRef.current) {
        const f = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'),
        );
        if (f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, goTo, index, items.length]);

  // ---------- Gestures ----------

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      axis: null,
      originX: 0,
      originY: 0,
      startIndex: index,
      samplesX: [{ t: e.timeStamp, v: e.clientX }],
      samplesY: [{ t: e.timeStamp, v: e.clientY }],
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId || closing.current) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (!g.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (g.axis === 'y' && dy < 0) {
        // Upward drags do nothing here.
        gesture.current = null;
        return;
      }
      // Grab whatever is moving, from where it is now.
      track.stop();
      dismissY.stop();
      g.originX = track.get();
      g.originY = dismissY.get();
      g.startX = e.clientX;
      g.startY = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    if (g.axis === 'x') {
      const min = -(items.length - 1) * widthRef.current;
      const raw = g.originX + (e.clientX - g.startX);
      const value =
        raw > 0
          ? rubberband(raw, widthRef.current)
          : raw < min
            ? min + rubberband(raw - min, widthRef.current)
            : raw;
      track.set(value);
      g.samplesX = pushSample(g.samplesX, { t: e.timeStamp, v: e.clientX });
    } else {
      const raw = g.originY + (e.clientY - g.startY);
      dismissY.set(raw < 0 ? rubberband(raw, heightRef.current) : raw);
      g.samplesY = pushSample(g.samplesY, { t: e.timeStamp, v: e.clientY });
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || !g.axis || e.pointerId !== g.pointerId) return;

    if (g.axis === 'x') {
      const velocity = velocityFromSamples(g.samplesX);
      const target = landingIndex({
        offset: track.get(),
        velocity,
        width: widthRef.current,
        startIndex: g.startIndex,
        count: items.length,
      });
      goTo(target, velocity);
    } else {
      const velocity = velocityFromSamples(g.samplesY);
      if (
        shouldDismiss({
          offset: dismissY.get(),
          velocity,
          distance: heightRef.current,
          threshold: 0.22,
        })
      ) {
        animate(dismissY, heightRef.current * 0.5, { ...springs.sheet, velocity });
        close(velocity);
      } else {
        animate(dismissY, 0, {
          ...(Math.abs(velocity) > FLICK_VELOCITY ? springs.flick : springs.settle),
          velocity,
        });
      }
    }
  };

  const current = items[index]!;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-[75] text-ivory"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[#05070c]/95"
        style={{ opacity: scrim }}
      />

      <motion.div
        ref={stageRef}
        className="absolute inset-0 touch-none overflow-hidden select-none"
        style={{ y: dismissY, scale: stageScale, opacity: presence, transformOrigin }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <motion.ul className="flex h-full" style={{ x: track }}>
          {items.map((item, i) => (
            <li
              key={item.src}
              className="relative h-full w-full shrink-0 px-4 pt-20 pb-28 sm:px-16"
              aria-hidden={i !== index}
            >
              <div className="relative h-full w-full">
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes="100vw"
                  quality={82}
                  draggable={false}
                  loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                  className="pointer-events-none object-contain"
                />
              </div>
            </li>
          ))}
        </motion.ul>
      </motion.div>

      <motion.div className="pointer-events-none absolute inset-0" style={{ opacity: scrim }}>
        <div className="pointer-events-auto absolute top-0 right-0 left-0 flex items-center justify-between p-4 sm:p-6">
          <p className="text-[0.85rem] text-ivory/75" aria-live="polite">
            {index + 1} / {items.length}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={() => close()}
            className="pressable grid size-11 place-items-center rounded-full bg-ivory/10 backdrop-blur-md hover:bg-ivory/20"
          >
            <CloseIcon size={22} />
            <span className="sr-only">Close photo viewer</span>
          </button>
        </div>

        <div className="pointer-events-auto absolute right-0 bottom-0 left-0 flex items-end justify-between gap-4 p-4 sm:p-6">
          <p className="type-small max-w-xl text-ivory/80">{current.caption ?? current.alt}</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="pressable grid size-11 place-items-center rounded-full bg-ivory/10 backdrop-blur-md hover:bg-ivory/20 disabled:opacity-30"
            >
              <ChevronLeft size={22} />
              <span className="sr-only">Previous photo</span>
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === items.length - 1}
              className="pressable grid size-11 place-items-center rounded-full bg-ivory/10 backdrop-blur-md hover:bg-ivory/20 disabled:opacity-30"
            >
              <ChevronRight size={22} />
              <span className="sr-only">Next photo</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
