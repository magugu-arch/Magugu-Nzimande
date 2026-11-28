'use client';

import { useEffect } from 'react';

/** Tells the boot script (src/lib/boot-script.ts) that React has finished taking over the page. */
export function HydrationSignal() {
  useEffect(() => {
    (window as Window & { __stReady?: boolean }).__stReady = true;
  }, []);
  return null;
}
