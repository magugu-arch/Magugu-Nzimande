'use client';

import type { ReactNode } from 'react';
import { usePlayer, type QueueItem } from './PlayerProvider';

type Props = { queue: QueueItem[]; start?: number; className?: string; children: ReactNode; label?: string };

/** Starts the persistent player from anywhere — server pages pass the queue in. */
export function ListenButton({ queue, start = 0, className, children, label }: Props) {
  const { playQueue } = usePlayer();
  return (
    <button
      type="button"
      className={className}
      onClick={() => playQueue(queue, start)}
      aria-label={label}
      data-cursor="Listen"
      disabled={queue.length === 0}
    >
      {children}
    </button>
  );
}
