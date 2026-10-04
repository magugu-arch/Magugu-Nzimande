import { useEffect, useState } from 'react';
import { clock } from '@/core/time/clock';

/** The demo-aware current time, re-read on an interval so countdowns move. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const t = setInterval(() => setNow(clock.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
