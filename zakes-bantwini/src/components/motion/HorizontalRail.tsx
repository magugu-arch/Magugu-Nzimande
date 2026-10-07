'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './HorizontalRail.module.css';

/**
 * Pinned horizontal catalogue (brief §10: "Music: horizontal / pinned
 * catalogue interaction"). On wide screens with motion allowed, vertical
 * scroll drives the rail sideways while the section stays pinned. Everywhere
 * else it is a native, swipeable, keyboard-scrollable row.
 */
export function HorizontalRail({ children, label }: { children: ReactNode; label: string }) {
  const section = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [distance, setDistance] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px) and (hover: hover)');
    const measure = () => {
      const t = track.current;
      const enable = query.matches && !reduce && Boolean(t);
      setPinned(enable);
      setDistance(enable && t ? Math.max(0, t.scrollWidth - window.innerWidth) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    query.addEventListener('change', measure);
    return () => {
      window.removeEventListener('resize', measure);
      query.removeEventListener('change', measure);
    };
  }, [reduce]);

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);

  if (!pinned || distance === 0) {
    return (
      <div ref={section} className={styles.native} data-motion="rail">
        <div ref={track} className={styles.nativeTrack} role="region" aria-label={label} tabIndex={0} data-motion-track="">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div ref={section} className={styles.pinSection} style={{ height: `calc(100vh + ${distance}px)` }}>
      <div className={styles.sticky}>
        <motion.div ref={track} className={styles.track} style={{ x }} role="region" aria-label={label}>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
