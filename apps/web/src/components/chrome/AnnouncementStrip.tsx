'use client';

import { CRAFT_LINE } from '@bbq/seed';
import { useEffect, useState } from 'react';

const MESSAGES = [
  CRAFT_LINE,
  'Delivery, collection and dine-in across Johannesburg.',
  'Half and Half: two sauces on one bird.',
];

const INTERVAL_MS = 5_000;

/**
 * Rotates three messages. Anyone who has asked for reduced motion gets the
 * first message and no rotation at all — a strip that changes under you is the
 * kind of movement the setting exists to stop.
 */
export function AnnouncementStrip() {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    const timer = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % MESSAGES.length);
        setFading(false);
      }, 350);
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex h-[34px] items-center overflow-hidden bg-red text-white">
      <div className="mx-auto w-full max-w-[1240px] px-5 text-center">
        <span
          className={[
            'text-[11px] font-bold uppercase tracking-[0.12em] transition-opacity duration-300',
            fading ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
        >
          {MESSAGES[index]}
        </span>
      </div>
    </div>
  );
}
