'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { type ReactNode, useRef, useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';

const QUERY = '(min-width: 768px) and (pointer: fine)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Parallax only where it reads well: wide screens with a precise pointer. */
function useParallaxAllowed() {
  const reduced = useReducedMotion();
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  return wide && !reduced;
}

/**
 * A layer that drifts as its frame scrolls out of view. Transform-only, so it
 * stays on the compositor; text never moves with it. Static on phones, on
 * touch devices and under reduced motion (brief §9).
 */
export function ParallaxLayer({
  children,
  distance = 90,
  scaleFrom = 1.05,
  className,
}: {
  children: ReactNode;
  /** px the layer travels while its frame scrolls away; negative moves it up. */
  distance?: number;
  scaleFrom?: number;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const allowed = useParallaxAllowed();
  const { scrollYProgress } = useScroll({ target: frame, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, distance]);
  const scale = useTransform(scrollYProgress, [0, 1], [scaleFrom, 1]);

  return (
    <div ref={frame} className={cn('absolute inset-0 overflow-hidden', className)}>
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={allowed ? { y, scale } : undefined}
      >
        {children}
      </motion.div>
    </div>
  );
}
