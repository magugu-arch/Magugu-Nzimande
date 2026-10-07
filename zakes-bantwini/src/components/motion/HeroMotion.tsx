'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * The hero image settles from a slight push-in on load, then eases away and
 * dims as the page scrolls past it (brief §10: "Hero: masked type reveal +
 * image movement").
 */
export function HeroMotion({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 900], ['0%', '14%']);
  const opacity = useTransform(scrollY, [0, 700], [1, 0.35]);

  return (
    <motion.div
      data-motion="hero"
      style={{ position: 'absolute', inset: 0, y: reduce ? 0 : y, opacity: reduce ? 1 : opacity }}
      initial={reduce ? false : { scale: 1.08 }}
      animate={{ scale: 1 }}
      transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
