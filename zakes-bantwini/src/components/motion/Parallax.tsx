'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Fraction of scroll distance the content drifts. 0.12 is a gentle architectural drift. */
  strength?: number;
  className?: string;
};

/**
 * Slow vertical drift tied to scroll (brief §10: "Architect: slow
 * architectural parallax"). The child should overscan its frame (scale ~1.15)
 * so edges never show. Off under reduced motion.
 */
export function Parallax({ children, strength = 0.12, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [`${-strength * 50}%`, `${strength * 50}%`]);

  return (
    <div ref={ref} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <motion.div style={{ position: 'absolute', inset: `-${strength * 60}% 0`, y: reduce ? 0 : y }}>{children}</motion.div>
    </div>
  );
}
