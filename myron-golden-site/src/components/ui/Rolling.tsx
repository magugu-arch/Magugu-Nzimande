'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { springs } from '@/lib/motion';

/**
 * The total rolls in the direction of the change — up when seats are added,
 * down when removed — on a critically damped spring, so rapid taps retarget
 * smoothly instead of queueing. Reduced motion keeps only the cross-fade.
 */
export function Rolling({ value, direction }: { value: string; direction: 1 | -1 }) {
  const reduce = useReducedMotion();
  const offset = reduce ? 0 : 0.6;
  return (
    <span aria-hidden="true" className="relative inline-flex overflow-hidden tabular-nums">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={{
            enter: (d: number) => ({ y: `${d * offset}em`, opacity: 0 }),
            center: { y: 0, opacity: 1 },
            exit: (d: number) => ({ y: `${-d * offset}em`, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={springs.settle}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
